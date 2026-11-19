import React from 'react';
import { EmergencyDemo } from '../emergency/demo';
import { useStore } from '../store';
import { Header, Hero, Screen } from '../ui';

export default function EmergencyDemoScreen() {
  const { user } = useStore();
  return (
    <Screen tint="red" voice={false}>
      <Header title="Clé d’urgence · Démo" fallback={user ? '/proches' : '/login'} />
      <Hero icon="key-outline" title="La Clé 48h" subtitle="Un proche choisi, des documents autorisés et 48 heures pour refuser." />
      <EmergencyDemo />
    </Screen>
  );
}
