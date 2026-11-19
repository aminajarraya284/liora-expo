import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { C } from '../theme';
import { useEmergencyKeys } from './use-emergency';

/** Requests are polled while the app is active, including outside the emergency screen. */
export function EmergencyAlert() {
  const { state } = useEmergencyKeys();
  const router = useRouter();
  const waiting = state.requests.filter((request) => request.role === 'owner' && request.status === 'waiting').length;
  const active = state.requests.filter((request) => request.role === 'owner' && request.status === 'active').length;
  if (!waiting && !active) return null;
  const title = waiting ? `${waiting} demande${waiting > 1 ? 's' : ''} d’accès d’urgence à examiner` : `${active} accès d’urgence ouvert${active > 1 ? 's' : ''}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. Voir mes clés.`} accessibilityLiveRegion="polite"
      onPress={() => router.push('/cle-urgence')}
      style={{ backgroundColor: C.goldSoft, paddingHorizontal: 20, paddingVertical: 12, minHeight: 48 }}>
      <Text style={{ color: C.title, fontWeight: 'bold' }}>{title}</Text>
      <Text style={{ color: C.title }}>Voir les demandes et gérer mes clés</Text>
    </Pressable>
  );
}
