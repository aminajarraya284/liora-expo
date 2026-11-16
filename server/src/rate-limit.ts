/**
 * Limite le nombre de requêtes par minute et par adresse, pour qu'un
 * appareil défaillant ou malveillant ne puisse pas faire grimper la facture.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs = 60_000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Renvoie 0 si la requête est acceptée, sinon le nombre de secondes à attendre. */
  check(key: string, now = Date.now()): number {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return 0;
    }
    if (entry.count >= this.limit) return Math.ceil((entry.resetAt - now) / 1000);
    entry.count += 1;
    return 0;
  }

  /** Oublie les adresses dont la fenêtre est terminée, pour que la mémoire ne grossisse pas indéfiniment. */
  private prune(now: number): void {
    if (this.hits.size < 5000) return;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

/** Secondes restantes avant minuit (heure universelle), pour l'en-tête Retry-After. */
export const secondsUntilTomorrow = (now = Date.now()): number => 86_400 - Math.floor((now % 86_400_000) / 1000);
