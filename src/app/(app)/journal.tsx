import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { frLong, frToISO, imgSource, isoToFr, todayISO, uid } from '../../lib';
import { type Note, useStore } from '../../store';
import { Btn, Card, CircleBtn, Empty, type FormField, FormSheet, Header, Hero, Icon, Screen, T, useColors, useDialog } from '../../ui';

const FIELDS: FormField[] = [
  { key: 'title', label: 'Titre', required: true, placeholder: 'Ex. : Belle promenade' },
  { key: 'text', label: 'Ma note', type: 'multiline', required: true, placeholder: 'Racontez votre journée…' },
  { key: 'date', label: 'Date', required: true, placeholder: 'JJ/MM/AAAA', maxLength: 10, validate: (value) => (frToISO(value) ? null : 'Date invalide. Format attendu : JJ/MM/AAAA.') },
  { key: 'photo', label: 'Ajouter une photo', type: 'image' },
];

/** Regroupe les notes par jour, du plus récent au plus ancien. */
function groupByDay(notes: Note[]): { date: string; notes: Note[] }[] {
  const groups: { date: string; notes: Note[] }[] = [];
  for (const note of [...notes].sort((a, b) => b.date.localeCompare(a.date))) {
    const last = groups[groups.length - 1];
    if (last && last.date === note.date) last.notes.push(note);
    else groups.push({ date: note.date, notes: [note] });
  }
  return groups;
}

export default function Journal() {
  const { data, update } = useStore();
  const dialog = useDialog();
  const colors = useColors();
  const [edit, setEdit] = useState<Note | 'new' | null>(null);
  const editing = edit && edit !== 'new' ? edit : null;
  const today = todayISO();
  const groups = groupByDay(data.notes);

  const remove = async (note: Note) => {
    setEdit(null); // on ferme la fiche avant de demander confirmation
    if (await dialog.confirm({ title: 'Supprimer cette note ?', message: `« ${note.title} » sera définitivement effacée.`, ok: 'Supprimer', danger: true })) {
      update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== note.id) }));
    }
  };

  const clearAll = async () => {
    if (await dialog.confirm({ title: 'Effacer tout le journal ?', message: 'Toutes vos notes seront définitivement effacées.', ok: 'Tout effacer', danger: true })) {
      update((d) => ({ ...d, notes: [] }));
    }
  };

  const options = () =>
    dialog.menu('Journal', [
      { label: 'Nouvelle note', icon: 'pencil-outline', onPress: () => setEdit('new') },
      { label: 'Effacer tout le journal', icon: 'trash-outline', danger: true, onPress: clearAll },
    ]);

  const save = (values: Record<string, any>) => {
    const note: Note = { id: editing?.id ?? uid(), title: values.title, text: values.text, date: frToISO(values.date)!, photo: values.photo };
    update((d) => ({ ...d, notes: editing ? d.notes.map((n) => (n.id === note.id ? note : n)) : [...d.notes, note] }));
    setEdit(null);
  };

  return (
    <Screen section="journal" tab="bienetre" speak="Journal. Mes notes, pensées et souvenirs." footer={<Btn label="Nouvelle note" icon="pencil-outline" onPress={() => setEdit('new')} />}>
      <Header title="Journal" right={<CircleBtn icon="ellipsis-vertical" label="Options" onPress={options} />} />
      <Hero title="Journal" subtitle="Mes notes, pensées et souvenirs" />

      {groups.length === 0 && <Empty icon="book-outline" text="Votre journal est vide. Écrivez votre première note." />}
      {groups.map((group, index) => (
        <View key={group.date} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: index ? 8 : 0, paddingHorizontal: 6 }}>
            <Icon name="calendar-outline" size={group.date === today ? 30 : 24} color={colors.title} />
            {group.date === today ? (
              <View>
                <T v="h3">Aujourd’hui</T>
                <T>{frLong(group.date)}</T>
              </View>
            ) : (
              <T style={{ fontSize: 17 }}>{frLong(group.date)}</T>
            )}
          </View>
          <View style={{ gap: 10 }}>
            {group.notes.map((note) => {
              const photo = imgSource(note.photo);
              return (
                <Card key={note.id} pad={10}>
                  <Pressable
                    onPress={() => setEdit(note)}
                    accessibilityRole="button"
                    accessibilityLabel={`${note.title}. ${note.text}`}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14 }, pressed && { opacity: 0.6 }]}>
                    {!!photo && <Image source={photo} style={{ width: 104, height: 86, borderRadius: 14 }} accessible={false} />}
                    <View style={{ flex: 1 }}>
                      <T v="h3" numberOfLines={2}>{note.title}</T>
                      <T numberOfLines={2}>{note.text}</T>
                    </View>
                    <Icon name="chevron-forward" size={22} color={colors.title} />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        </View>
      ))}

      <FormSheet
        visible={!!edit}
        title={editing ? 'Modifier la note' : 'Nouvelle note'}
        fields={FIELDS}
        initial={editing ? { ...editing, date: isoToFr(editing.date) } : { date: isoToFr(today) }}
        onClose={() => setEdit(null)}
        onSubmit={save}
        onDelete={editing ? () => remove(editing) : undefined}
      />
    </Screen>
  );
}
