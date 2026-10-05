import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

// APP_ORIGIN is an exact deployment origin, never a wildcard.
const origin = Deno.env.get('APP_ORIGIN') || 'http://localhost:5173';
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors });
  if (request.headers.get('origin') && request.headers.get('origin') !== origin)
    return new Response(null, { status: 403, headers: cors });
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: cors });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer '))
    return new Response(null, { status: 401, headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    // getUser contacts Supabase Auth to verify the JWT, including asymmetric signing keys.
    const {
      data: { user },
      error: authError,
    } = await service.auth.getUser(authorization.slice(7));
    if (authError || !user)
      return new Response(null, { status: 401, headers: cors });
    const { data: allowed, error: allowedError } = await service
      .from('allowed_emails')
      .select('email')
      .eq('email', (user.email || '').toLowerCase())
      .maybeSingle();
    if (allowedError || !allowed)
      return new Response(null, { status: 403, headers: cors });
    if (Number(request.headers.get('content-length') || 0) > 10_000)
      return new Response(null, { status: 413, headers: cors });
    const raw = await request.text();
    if (raw.length > 10_000)
      return new Response(null, { status: 413, headers: cors });
    const body: unknown = JSON.parse(raw);
    if (
      !body ||
      typeof body !== 'object' ||
      !('refresh_token' in body) ||
      typeof body.refresh_token !== 'string' ||
      body.refresh_token.length < 1 ||
      body.refresh_token.length > 8192
    ) {
      return new Response(null, { status: 400, headers: cors });
    }
    const { error } = await service.from('google_tokens').upsert({
      user_id: user.id,
      refresh_token: body.refresh_token,
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      const { error: statusError } = await service
        .from('integration_status')
        .upsert({
          user_id: user.id,
          google_connected: true,
          google_error: null,
        });
      if (statusError)
        return new Response(null, { status: 500, headers: cors });
    }
    return new Response(null, { status: error ? 500 : 204, headers: cors });
  } catch {
    // Never log requests, provider tokens or service credentials.
    return new Response(null, { status: 400, headers: cors });
  }
});
