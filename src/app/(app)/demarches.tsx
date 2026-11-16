import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { OFFICIAL_LINKS } from '../../features/links/official-links';
import { displayHost, normalizeUrlInput, parseHttpsUrl, uid } from '../../lib';
import { type SavedLink, useStore } from '../../store';
import { Card, CircleBtn, Divider, Empty, type FormField, FormSheet, Header, Hero, Icon, OutlineBtn, Row, Screen, SectionTitle, T, useDialog, usePalette } from '../../ui';

const LINK_FIELDS: FormField[] = [
  { key: 'name', label: 'Nom du site', required: true, placeholder: 'Ex. : Ma mutuelle', maxLength: 40 },
  {
    key: 'url', label: 'Adresse du site', type: 'url', required: true, placeholder: 'www.ma-mutuelle.fr',
    help: 'Recopiez l’adresse depuis un courrier officiel, jamais depuis un message reçu.',
    validate: (value) => (parseHttpsUrl(normalizeUrlInput(value)) ? null : 'Adresse invalide. Exemple : www.ma-mutuelle.fr'),
  },
];

export default function Demarches() {
  const { data, update } = useStore();
  const router = useRouter();
  const dialog = useDialog();
  const palette = usePalette('navy');
  const [edit, setEdit] = useState<SavedLink | 'new' | null>(null);
  const editing = edit && edit !== 'new' ? edit : null;

  const open = (id: string) => router.push({ pathname: '/navigateur', params: { lien: id } } as never);

  const save = (values: Record<string, any>) => {
    const link: SavedLink = { id: editing?.id ?? uid(), name: values.name, url: normalizeUrlInput(values.url) };
    update((d) => ({ ...d, links: editing ? d.links.map((l) => (l.id === link.id ? link : l)) : [...d.links, link] }));
    setEdit(null);
  };

  const remove = async (link: SavedLink) => {
    setEdit(null); // on ferme la fiche avant de demander confirmation
    if (await dialog.confirm({ title: `Supprimer « ${link.name} » ?`, message: 'Ce lien sera retiré de votre liste.', ok: 'Supprimer', danger: true })) {
      update((d) => ({ ...d, links: d.links.filter((l) => l.id !== link.id) }));
    }
  };

  const help = () => dialog.alert('Aide', 'Touchez un site pour l’ouvrir dans le navigateur privé de LIORA. Rien n’y est conservé : ni historique, ni mot de passe. Vous pouvez ajouter vos propres sites, comme celui de votre mutuelle.');

  return (
    <Screen section="demarches" speak="Mes démarches. Vos sites utiles, en navigation privée.">
      <Header title="Démarches" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={help} />} />
      <Hero title="Mes démarches" subtitle="Vos sites utiles, en navigation privée" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.soft, borderRadius: 20, padding: 14 }}>
        <Icon name="mc:incognito" size={34} color={palette.ink} />
        <T style={{ flex: 1 }}>Navigation privée : aucun historique ni mot de passe n’est conservé. Vérifiez toujours le nom du site affiché en haut de la page.</T>
      </View>

      <View>
        <SectionTitle>Sites utiles</SectionTitle>
        <Card pad={12} style={{ paddingVertical: 4 }}>
          {OFFICIAL_LINKS.map((link, index) => (
            <View key={link.id}>
              {index > 0 && <Divider />}
              <Row icon={link.icon} title={link.name} subtitle={link.purpose} onPress={() => open(link.id)} />
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionTitle>Mes liens</SectionTitle>
        {data.links.length === 0 ? (
          <Empty icon="link-outline" text="Ajoutez ici vos propres sites : mutuelle, banque, caisse de retraite…" />
        ) : (
          <Card pad={12} style={{ paddingVertical: 4 }}>
            {data.links.map((link, index) => (
              <View key={link.id}>
                {index > 0 && <Divider />}
                <Row
                  plainIcon
                  icon="link-outline"
                  title={link.name}
                  subtitle={displayHost(parseHttpsUrl(link.url)?.host ?? '')}
                  onPress={() => open(link.id)}
                  chevron={false}
                  right={<CircleBtn icon="create-outline" label={`Modifier ${link.name}`} onPress={() => setEdit(link)} />}
                />
              </View>
            ))}
          </Card>
        )}
        <OutlineBtn label="Ajouter un lien" icon="add" onPress={() => setEdit('new')} style={{ marginTop: 12 }} />
      </View>

      <Card style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Icon name="shield-checkmark-outline" size={30} color={palette.ink} />
          <T style={{ flex: 1 }}>LIORA ne vous demandera jamais vos identifiants ni vos codes. Ne les communiquez à personne, même par téléphone.</T>
        </View>
      </Card>

      <FormSheet
        visible={!!edit}
        title={editing ? 'Modifier le lien' : 'Ajouter un lien'}
        fields={LINK_FIELDS}
        initial={editing ?? undefined}
        onClose={() => setEdit(null)}
        onSubmit={save}
        onDelete={editing ? () => remove(editing) : undefined}
      />
    </Screen>
  );
}
