/**
 * Réinitialisation du mot de passe par e-mail.
 *
 * L'envoi d'un e-mail nécessite un serveur. Renseignez la variable
 * d'environnement EXPO_PUBLIC_PASSWORD_RESET_URL avec l'adresse de votre
 * service : l'application y envoie `POST { "email": "…" }` et attend une
 * réponse 2xx. Sans cette variable, l'écran indique honnêtement que le
 * service n'est pas disponible plutôt que d'annoncer un e-mail jamais envoyé.
 */
const ENDPOINT = process.env.EXPO_PUBLIC_PASSWORD_RESET_URL;

export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ENDPOINT) {
    return { ok: false, error: 'La réinitialisation par e-mail n’est pas encore disponible. Contactez l’assistance LIORA.' };
  }
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (!res.ok) return { ok: false, error: 'Le service est momentanément indisponible. Veuillez réessayer plus tard.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Connexion impossible. Vérifiez votre accès à Internet puis réessayez.' };
  }
}
