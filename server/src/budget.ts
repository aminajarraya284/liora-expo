import { createHash } from 'node:crypto';

export type BudgetResult = 'allowed' | 'device' | 'global';
export type BudgetRequest = { kind: 'assistant' | 'mood'; device: string; deviceLimit: number; globalLimit: number };
export type DailyBudget = { take(request: BudgetRequest): Promise<BudgetResult> };

/** Réservé au développement : en production les compteurs sont partagés dans Redis. */
export function memoryBudget(clock: () => number = Date.now): DailyBudget {
  let day = '';
  const counts = new Map<string, number>();
  return {
    async take({ kind, device, deviceLimit, globalLimit }) {
      const today = new Date(clock()).toISOString().slice(0, 10);
      if (day !== today) { day = today; counts.clear(); }
      const key = `${kind}:${device}`;
      const used = counts.get(key) ?? 0;
      const global = counts.get('global') ?? 0;
      if (used >= deviceLimit) return 'device';
      if (global >= globalLimit) return 'global';
      counts.set(key, used + 1);
      counts.set('global', global + 1);
      return 'allowed';
    },
  };
}

/** Vérification et incrément des deux compteurs en une seule opération atomique. */
const RESERVE = `
local device = tonumber(redis.call('GET', KEYS[1]) or '0')
local total = tonumber(redis.call('GET', KEYS[2]) or '0')
if device >= tonumber(ARGV[1]) then return 1 end
if total >= tonumber(ARGV[2]) then return 2 end
redis.call('INCR', KEYS[1])
redis.call('EXPIREAT', KEYS[1], ARGV[3])
redis.call('INCR', KEYS[2])
redis.call('EXPIREAT', KEYS[2], ARGV[3])
return 0`;

/** API REST Redis (Upstash). Aucun message, photo ou renseignement de compte n'est envoyé. */
export function redisBudget(url: string, token: string, fetchFn: typeof fetch = fetch): DailyBudget {
  return {
    async take({ kind, device, deviceLimit, globalLimit }) {
      const now = Date.now();
      const day = new Date(now).toISOString().slice(0, 10);
      const tag = `{liora:budget:${day}}`;
      const id = createHash('sha256').update(device).digest('hex');
      const expiresAt = Math.floor(now / 86_400_000) * 86_400 + 86_400;
      const response = await fetchFn(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', RESERVE, '2', `${tag}:${kind}:${id}`, `${tag}:global`, String(deviceLimit), String(globalLimit), String(expiresAt)]),
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('BUDGET_UNAVAILABLE');
      const body = await response.json() as { result?: unknown; error?: unknown } | null;
      if (!body || body.error || ![0, 1, 2].includes(body.result as number)) throw new Error('BUDGET_UNAVAILABLE');
      return body.result === 0 ? 'allowed' : body.result === 1 ? 'device' : 'global';
    },
  };
}
