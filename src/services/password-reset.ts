import { cloudClient, cloudConfigurationError } from '../cloud/client';
import type { Result } from '../state/types';
import { isEmail } from '../utils/validation';

/** Le modèle d'e-mail Supabase affiche {{ .Token }} pour la saisie du code dans l'app. */
export async function requestPasswordReset(email: string, mode: 'local' | 'cloud' = 'local'): Promise<Result> {
  if (!isEmail(email)) return { ok: false, error: 'Veuillez saisir une adresse e-mail valide.' };
  if (mode === 'local') return { ok: false, error: 'Les comptes enregistrés uniquement sur ce téléphone ne disposent pas de réinitialisation par e-mail.' };
  if (!cloudClient) return { ok: false, error: cloudConfigurationError ?? 'Le mode en ligne n’est pas encore configuré.' };
  try {
    const { error } = await cloudClient.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) return { ok: false, error: 'L’envoi du code est momentanément indisponible. Réessayez plus tard.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Connexion impossible. Vérifiez votre accès à Internet puis réessayez.' };
  }
}
