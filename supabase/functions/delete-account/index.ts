import { createClient } from '@supabase/supabase-js';
import { createDeleteAccountHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
function defaultKey(name: string, legacy: string): string {
  try {
    const keys = JSON.parse(Deno.env.get(name) ?? '{}') as Record<string, unknown>;
    if (typeof keys.default === 'string' && keys.default) return keys.default;
  } catch { /* Ancien environnement Supabase : utiliser la clé injectée historique. */ }
  return Deno.env.get(legacy) ?? '';
}
const publishable = defaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const secret = defaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
};

// Le secret administratif reste exclusivement dans l'environnement de l'Edge Function.
const userClient = createClient(url, publishable, options);
const admin = createClient(url, secret, options);
const bucket = admin.storage.from('liora-files');
const handler = createDeleteAccountHandler({
  async authenticate(jwt) {
    const { data, error } = await userClient.auth.getUser(jwt);
    return error || !data.user?.email ? null : { id: data.user.id, email: data.user.email };
  },
  async verifyPassword(email, password) {
    const verifier = createClient(url, publishable, options);
    const { data, error } = await verifier.auth.signInWithPassword({ email, password });
    return error || !data.user ? null : { id: data.user.id };
  },
  async markDeleting(userId) {
    const { error } = await admin.from('liora_account_deletions').upsert({ user_id: userId });
    if (error) throw error;
  },
  async signOutGlobally(jwt) {
    const { error } = await admin.auth.admin.signOut(jwt, 'global');
    if (error) throw error;
  },
  async listFiles(prefix) {
    const { data, error } = await bucket.list(prefix, { limit: 500, offset: 0, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    return (data ?? []).map((file) => ({ id: file.id, name: file.name }));
  },
  async removeFiles(paths) {
    const { error } = await bucket.remove(paths);
    if (error) throw error;
  },
  async deleteUser(userId) {
    const { error } = await admin.auth.admin.deleteUser(userId, false);
    if (error) throw error;
  },
});

Deno.serve(handler);
