import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import type { Database } from '../../../src/types/database.ts';
export const service = createClient<Database>(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const origin = Deno.env.get('APP_ORIGIN') || 'http://localhost:5173';
export const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};
export function respond(status: number, body?: object) {
  if (status === 204) return new Response(null, { status, headers: cors });
  const errors: Record<number, string> = {
    400: 'invalid_request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not_found',
    405: 'method_not_allowed',
    500: 'temporarily_unavailable',
    503: 'temporarily_unavailable',
  };
  return new Response(
    JSON.stringify(body ?? { error: errors[status] ?? 'request_failed' }),
    {
      status,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        ...(status === 405 ? { Allow: 'POST, OPTIONS' } : {}),
      },
    },
  );
}
export async function authorize(
  request: Request,
): Promise<{ userId: string | null } | Response> {
  if (request.method === 'OPTIONS') return respond(204);
  if (request.method !== 'POST') return respond(405);
  if (request.headers.get('origin') && request.headers.get('origin') !== origin)
    return respond(403);
  const expected = Deno.env.get('CRON_SECRET');
  const provided = request.headers.get('x-cron-secret');
  if (expected && provided) {
    const encoder = new TextEncoder();
    const [a, b] = await Promise.all([
      crypto.subtle.digest('SHA-256', encoder.encode(expected)),
      crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    ]);
    const x = new Uint8Array(a),
      y = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    if (diff === 0) return { userId: null };
  }
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return respond(401);
  const {
    data: { user },
    error,
  } = await service.auth.getUser(bearer.slice(7));
  if (error || !user) return respond(401);
  const { data: allowed, error: allowedError } = await service
    .from('allowed_emails')
    .select('email')
    .eq('email', (user.email || '').toLowerCase())
    .maybeSingle();
  if (allowedError || !allowed) return respond(403);
  return { userId: user.id };
}
export function checked(error: unknown) {
  if (error) throw new Error('Database operation failed');
}
