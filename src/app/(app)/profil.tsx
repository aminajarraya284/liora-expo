import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HEALTH_FIELDS, PERSONAL_FIELDS, PROFILE_FIELDS } from '../../forms';
import { openLink, telUrl } from '../../lib';
import { PHOTOS } from '../../photos';
import { useStore } from '../../store';
import { F } from '../../theme';
import { Avatar, Btn, Card, CircleBtn, Divider, FormSheet, Icon, Logo, MenuBtn, PhotoBanner, Row, Screen, SectionTitle, SosBtn, T, useColors, useDialog, usePalette, usePhotosEnabled } from '../../ui';

function ContactLine({ icon, label, value, onPress, big }: { icon: string; label: string; value: string; onPress: () => void; big?: boolean }) {
  const colors = useColors();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value || 'non renseigné'}`}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 4 }, pressed && { opacity: 0.6 }]}>
      <View style={{ width: 54, height: 48, borderRadius: 14, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={palette.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="small">{label}</T>
        <T style={{ fontFamily: big ? F.bold : F.semi, fontSize: big ? 20 : 17, color: colors.title }} numberOfLines={1}>{value || 'Non renseigné'}</T>
      </View>
      <Icon name="chevron-forward" size={22} color={colors.title} />
    </Pressable>
  );
}

export default function Profil() {
  const { data, update } = useStore();
  const router = useRouter();
  const dialog = useDialog();
  const palette = usePalette('bordeaux');
  const photosEnabled = usePhotosEnabled();
  const [sheet, setSheet] = useState<null | 'profile' | 'personal' | 'health'>(null);
  const profile = data.profile;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

  const call = async () => {
    if (!profile.phone) return setSheet('profile');
    if (!(await openLink(telUrl(profile.phone)))) dialog.alert('Appel impossible', 'Cet appareil ne peut pas passer d’appel.');
  };

  return (
    <Screen section="profil" tab="main" speak={`Profil de ${fullName}.`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MenuBtn />
          <Logo size={24} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SosBtn />
          <CircleBtn icon="notifications-outline" label="Notifications" onPress={() => router.push('/reglages/notifications')} />
        </View>
      </View>
      {photosEnabled ? (
        <PhotoBanner photo={PHOTOS.profil} title="Profil" height={130} />
      ) : (
        <T v="h1" center style={{ marginTop: 6, fontSize: 32 }} accessibilityRole="header">Profil</T>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8, marginBottom: 16, paddingHorizontal: 4 }}>
        <Avatar photo={profile.photo} name={fullName} size={124} />
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontSize: 25 }}>{fullName}</T>
          {!!profile.age && <T style={{ fontSize: 17 }}>{profile.age} ans</T>}
          {!!profile.city && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Icon name="location" size={20} color={palette.ink} />
              <T style={{ fontSize: 17 }}>{profile.city}</T>
            </View>
          )}
        </View>
      </View>

      <Card pad={8}>
        <ContactLine icon="call-outline" label="Téléphone" value={profile.phone} big onPress={call} />
        <Divider />
        <ContactLine icon="mail-outline" label="E-mail" value={profile.email} onPress={() => setSheet('profile')} />
      </Card>

      <View>
        <SectionTitle>Mes informations</SectionTitle>
        <Card pad={10} style={{ paddingVertical: 4 }}>
          <Row icon="person-outline" title="Informations personnelles" subtitle="Nom, âge, adresse" onPress={() => setSheet('personal')} />
          <Divider />
          <Row icon="heart-outline" title="Informations santé" subtitle="Traitements, allergies, médecin" onPress={() => setSheet('health')} />
          <Divider />
          <Row icon="people-outline" title="Mes proches" subtitle="Contacts et aidants" onPress={() => router.push('/proches')} />
        </Card>
      </View>

      <Btn label="Modifier mon profil" icon="create-outline" chevron onPress={() => setSheet('profile')} style={{ marginTop: 18 }} />

      <FormSheet visible={sheet === 'profile'} title="Modifier mon profil" fields={PROFILE_FIELDS} initial={profile} onClose={() => setSheet(null)}
        onSubmit={(values) => { update((d) => ({ ...d, profile: { ...d.profile, ...values } })); setSheet(null); }} />
      <FormSheet visible={sheet === 'personal'} title="Informations personnelles" fields={PERSONAL_FIELDS} initial={profile} onClose={() => setSheet(null)}
        onSubmit={(values) => { update((d) => ({ ...d, profile: { ...d.profile, ...values } })); setSheet(null); }} />
      <FormSheet visible={sheet === 'health'} title="Informations santé" fields={HEALTH_FIELDS} initial={data.health} onClose={() => setSheet(null)}
        onSubmit={(values) => { update((d) => ({ ...d, health: { ...d.health, ...values } })); setSheet(null); }} />
    </Screen>
  );
}
