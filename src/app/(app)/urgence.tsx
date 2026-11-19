import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HEALTH_FIELDS, PROCHE_FIELDS, saveProche } from '../../forms';
import { openLink, telUrl } from '../../lib';
import { useStore } from '../../store';
import { Avatar, Btn, Card, CircleBtn, Divider, FormSheet, Header, Hero, Icon, Row, Screen, T, useColors, useDialog, usePalette } from '../../ui';

function BlockTitle({ icon, children }: { icon: string; children: string }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: palette.btn[1], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color="#fff" />
      </View>
      <T v="h3" style={{ flex: 1, fontSize: 21 }} accessibilityRole="header">{children}</T>
    </View>
  );
}

export default function Urgence() {
  const { data, update } = useStore();
  const router = useRouter();
  const dialog = useDialog();
  const colors = useColors();
  const palette = usePalette('red');
  const [sheet, setSheet] = useState<null | 'health' | 'proche'>(null);
  const contacts = data.proches.filter((p) => p.emergency);
  const main = data.proches.find((p) => p.primary) ?? contacts[0] ?? data.proches[0];

  const call = async (phone: string) => {
    if (!(await openLink(telUrl(phone)))) dialog.alert('Appel impossible', `Cet appareil ne peut pas passer d’appel. Composez le ${phone}.`);
  };

  const emergencyNumbers = () =>
    dialog.menu('Numéros d’urgence', [
      { label: 'Appeler le 15 (SAMU)', icon: 'medkit-outline', danger: true, onPress: () => call('15') },
      { label: 'Appeler le 112 (urgences)', icon: 'call-outline', danger: true, onPress: () => call('112') },
      { label: 'Gérer mes proches', icon: 'people-outline', onPress: () => router.push('/proches') },
    ]);

  return (
    <Screen
      section="urgence"
      tab="social"
      speak="Urgence. Un accès rapide aux informations essentielles et à mes contacts d’urgence."
      footer={<Btn label={main ? 'Appeler un proche' : 'Ajouter un contact'} icon="call" onPress={() => (main ? call(main.phone) : setSheet('proche'))} />}>
      <Header title="Urgence" right={<CircleBtn icon="ellipsis-vertical" label="Numéros d’urgence" onPress={emergencyNumbers} />} />
      <Hero title="Urgence" subtitle="Un accès rapide aux informations essentielles et à mes contacts d’urgence" />

      <Card style={{ marginBottom: 14 }}>
        <Row icon="key-outline" title="Clé d’urgence 48h" subtitle="Choisir un proche et les documents accessibles" onPress={() => router.push('/cle-urgence')} />
        <Divider />
        <Row icon="enter-outline" title="J’ai reçu une clé" subtitle="Demander l’accès aux documents d’un proche" onPress={() => router.push('/acces-urgence')} />
      </Card>

      <Card>
        <BlockTitle icon="call-outline">Mes contacts d’urgence</BlockTitle>
        {contacts.map((contact) => (
          <View key={contact.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <Avatar photo={contact.photo} name={contact.name} size={58} />
              <View style={{ flex: 1 }}>
                <T v="h3">{contact.name}</T>
                <T>{contact.relation}  •  {contact.phone}</T>
              </View>
              <Pressable
                onPress={() => call(contact.phone)}
                accessibilityRole="button"
                accessibilityLabel={`Appeler ${contact.name}`}
                hitSlop={6}
                style={({ pressed }) => [{ width: 52, height: 52, borderRadius: 26, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
                <Icon name="call" size={24} color={palette.ink} />
              </Pressable>
            </View>
            <Divider />
          </View>
        ))}
        <Pressable onPress={() => setSheet('proche')} accessibilityRole="button" accessibilityLabel="Ajouter un contact d’urgence" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }, pressed && { opacity: 0.6 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
            <Icon name="add" size={24} color={palette.ink} />
          </View>
          <T style={{ flex: 1, fontSize: 17 }}>Ajouter un contact d’urgence</T>
          <Icon name="chevron-forward" size={22} color={colors.title} />
        </Pressable>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <BlockTitle icon="medkit-outline">Mes informations médicales</BlockTitle>
        <Row plainIcon icon="mc:heart-pulse" title="Antécédents" subtitle={data.health.antecedents || 'Non renseigné'} onPress={() => setSheet('health')} />
        <Divider />
        <Row plainIcon icon="mc:pill" title="Traitements en cours" subtitle={data.treatments.map((t) => t.name).join(', ') || 'Aucun traitement'} onPress={() => router.push('/traitements')} />
        <Divider />
        <Row plainIcon icon="flower-outline" title="Allergies" subtitle={data.health.allergies || 'Non renseigné'} onPress={() => setSheet('health')} />
      </Card>

      <FormSheet visible={sheet === 'health'} title="Informations médicales" fields={HEALTH_FIELDS} initial={data.health} onClose={() => setSheet(null)}
        onSubmit={(values) => { update((d) => ({ ...d, health: { ...d.health, ...values } })); setSheet(null); }} />
      <FormSheet visible={sheet === 'proche'} title="Ajouter un contact d’urgence" fields={PROCHE_FIELDS.filter((f) => f.key !== 'emergency')} initial={{ primary: data.proches.length === 0 }} onClose={() => setSheet(null)}
        onSubmit={(values) => { update((d) => ({ ...d, proches: saveProche(d.proches, { ...values, emergency: true }) })); setSheet(null); }} />
    </Screen>
  );
}
