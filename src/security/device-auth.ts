import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** Vrai si l'appareil peut vérifier son propriétaire (Face ID, empreinte ou code du téléphone). */
export async function deviceAuthAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export type DeviceAuthResult = 'ok' | 'cancelled' | 'unavailable';

/** Demande Face ID / l'empreinte, avec repli sur le code du téléphone. */
export async function authenticateOnDevice(reason: string): Promise<DeviceAuthResult> {
  if (!(await deviceAuthAvailable())) return 'unavailable';
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Annuler',
      fallbackLabel: 'Utiliser le code du téléphone',
      disableDeviceFallback: false,
    });
    if (result.success) return 'ok';
    const unavailable = ['not_available', 'not_enrolled', 'passcode_not_set', 'lockout'];
    return unavailable.includes(result.error) ? 'unavailable' : 'cancelled';
  } catch {
    return 'unavailable';
  }
}
