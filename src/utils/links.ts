import { Linking } from 'react-native';

/** Ouvre un lien du système (téléphone, SMS…). Renvoie false si l'appareil ne sait pas le traiter. */
export async function openLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// On ne garde que les chiffres et le « + » : aucun autre caractère ne peut se glisser dans le lien.
const digits = (phone: string) => phone.replace(/[^\d+]/g, '');
export const telUrl = (phone: string): string => `tel:${digits(phone)}`;
export const smsUrl = (phone: string): string => `sms:${digits(phone)}`;
