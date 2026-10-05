import { service, authorize, checked, respond } from '../_shared/worker.ts';
import { calendarPayload, googleEventId } from '../_shared/calendar-payload.ts';
import type { Tables } from '../../../src/types/database.ts';

class SyncError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function accessToken(userId: string) {
  const { data, error } = await service
    .from('google_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  checked(error);
  if (!data) throw new SyncError('reconnect');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new SyncError(
      response.status === 400 ? 'reconnect' : 'google_unavailable',
    );
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('access_token' in body) ||
    typeof body.access_token !== 'string'
  )
    throw new SyncError('google_unavailable');
  return body.access_token;
}
async function sync(job: Tables<'sync_outbox'>, token: string) {
  const { data: settings, error: settingsError } = await service
    .from('user_settings')
    .select('google_calendar_id')
    .eq('user_id', job.user_id)
    .single();
  checked(settingsError);
  const { data: event, error } = await service
    .from('events')
    .select('*')
    .eq('id', job.event_id)
    .eq('user_id', job.user_id)
    .maybeSingle();
  checked(error);
  let id =
    job.google_event_id ||
    event?.google_event_id ||
    googleEventId(job.event_id);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings!.google_calendar_id)}/events`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const request = (url: string, method: string, body?: object) =>
    fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  let response: Response;
  if (job.action === 'delete' || !event || !event.active) {
    response = await request(`${base}/${encodeURIComponent(id)}`, 'DELETE');
    if (!response.ok && response.status !== 404 && response.status !== 410)
      throw new SyncError(
        response.status === 401 ? 'reconnect' : `google_${response.status}`,
      );
  } else {
    const payload = calendarPayload(event);
    response = await request(
      `${base}/${encodeURIComponent(id)}`,
      'PUT',
      payload,
    );
    if (response.status === 404 || response.status === 410) {
      if (response.status === 410) id = googleEventId(crypto.randomUUID());
      // Persist identity before creation so a racing deletion always queues the right id.
      const { data: stored, error: storeError } = await service
        .from('events')
        .update({ google_event_id: id })
        .eq('id', event.id)
        .eq('user_id', job.user_id)
        .select('id');
      checked(storeError);
      if (stored?.length) {
        response = await request(base, 'POST', { id, ...payload });
        if (response.status === 409)
          response = await request(
            `${base}/${encodeURIComponent(id)}`,
            'PUT',
            payload,
          );
        if (response.status === 410) {
          const { error } = await service
            .from('events')
            .update({ google_event_id: googleEventId(crypto.randomUUID()) })
            .eq('id', event.id)
            .eq('user_id', job.user_id);
          checked(error);
          throw new SyncError('temporarily_unavailable');
        }
      } else response = new Response(null, { status: 204 });
    }
    if (!response.ok)
      throw new SyncError(
        response.status === 401 ? 'reconnect' : `google_${response.status}`,
      );
  }
  if (event) {
    const { error } = await service
      .from('events')
      .update({
        google_event_id: event.active && job.action !== 'delete' ? id : null,
        google_synced_at: new Date().toISOString(),
        google_sync_error: null,
      })
      .eq('id', event.id)
      .eq('user_id', job.user_id);
    checked(error);
  }
  const { error: statusError } = await service
    .from('integration_status')
    .upsert({
      user_id: job.user_id,
      google_connected: true,
      google_last_success: new Date().toISOString(),
      google_error: null,
    });
  checked(statusError);
  const { error: jobError } = await service
    .from('sync_outbox')
    .update({
      processed_at: new Date().toISOString(),
      last_error: null,
      lease_until: null,
    })
    .eq('id', job.id);
  checked(jobError);
}
Deno.serve(async (request: Request) => {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const owner = crypto.randomUUID();
  let locked = false;
  let processed = 0;
  let failed = 0;
  try {
    if (
      !Deno.env.get('GOOGLE_CLIENT_ID') ||
      !Deno.env.get('GOOGLE_CLIENT_SECRET')
    )
      return respond(503, { error: 'not_configured' });
    const { data: claim, error: claimError } = await service.rpc(
      'claim_worker',
      { p_name: 'calendar-sync', p_owner: owner },
    );
    checked(claimError);
    if (!claim) return respond(202, { busy: true });
    locked = true;
    const { data: jobs, error } = await service.rpc('claim_sync_jobs', {
      p_user_id: auth.userId || undefined,
      p_limit: 10,
    });
    checked(error);
    const tokens = new Map<string, string>();
    const deadline = Date.now() + 70000;
    for (const job of jobs || []) {
      if (Date.now() > deadline) break;
      try {
        let token = tokens.get(job.user_id);
        if (!token) {
          token = await accessToken(job.user_id);
          tokens.set(job.user_id, token);
        }
        await sync(job, token);
        processed++;
      } catch (error) {
        failed++;
        const code =
          error instanceof SyncError ? error.code : 'temporarily_unavailable';
        const { error: retryError } = await service
          .from('sync_outbox')
          .update({
            attempts: job.attempts + 1,
            last_error: code,
            lease_until: null,
            available_at: new Date(
              Date.now() +
                Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)) * 1000,
            ).toISOString(),
          })
          .eq('id', job.id);
        checked(retryError);
        const { error: statusError } = await service
          .from('integration_status')
          .upsert({
            user_id: job.user_id,
            google_error: code,
            ...(code === 'reconnect' ? { google_connected: false } : {}),
          });
        checked(statusError);
        const { error: eventError } = await service
          .from('events')
          .update({ google_sync_error: code })
          .eq('id', job.event_id)
          .eq('user_id', job.user_id);
        checked(eventError);
      }
    }
    return respond(200, { processed, failed });
  } catch {
    return respond(500, { error: 'temporarily_unavailable' });
  } finally {
    if (locked)
      await service
        .from('worker_leases')
        .delete()
        .eq('name', 'calendar-sync')
        .eq('owner', owner);
  }
});
