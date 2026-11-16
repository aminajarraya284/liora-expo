import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { frLong, normTime, todayISO, uid } from '../../lib';
import { type Treatment, useStore } from '../../store';
import { Btn, Card, Check, CircleBtn, Divider, Empty, type FormField, FormSheet, Header, Hero, Icon, Pill, Screen, SectionTitle, T, tap, useColors, useDialog, usePalette } from '../../ui';

const parseTimes = (value: string) => value.split(/[,;]|\bet\b/).map((part) => part.trim()).filter(Boolean).map(normTime);

const FIELDS: FormField[] = [
  { key: 'name', label: 'Médicament', required: true, placeholder: 'Nom inscrit sur la boîte', maxLength: 80 },
  { key: 'dose', label: 'Dose', placeholder: 'Ex. : 1 comprimé', maxLength: 80 },
  {
    key: 'times', label: 'Heures de prise', required: true, placeholder: 'Ex. : 8h, 20h', maxLength: 80,
    validate: (value) => {
      const times = parseTimes(value);
      return times.length && times.every(Boolean) ? null : 'Indiquez une ou plusieurs heures, par exemple : 8h, 20h.';
    },
  },
];

export default function Traitements() {
  const { data, update } = useStore();
  const dialog = useDialog();
  const colors = useColors();
  const palette = usePalette('green');
  const [edit, setEdit] = useState<Treatment | 'new' | null>(null);
  const editing = edit && edit !== 'new' ? edit : null;

  const doses = data.treatments
    .flatMap((treatment) => treatment.times.map((time) => ({ key: `${treatment.id}@${time}`, time, treatment })))
    .sort((a, b) => a.time.localeCompare(b.time));
  const takenCount = doses.filter((dose) => data.day.taken[dose.key]).length;

  const toggle = (key: string, taken: boolean) => {
    tap();
    update((d) => ({ ...d, day: { ...d.day, taken: { ...d.day.taken, [key]: taken } } }));
  };

  const remove = async (treatment: Treatment) => {
    setEdit(null); // on ferme la fiche avant de demander confirmation
    if (await dialog.confirm({ title: `Supprimer ${treatment.name} ?`, message: 'Ce traitement sera retiré de votre liste.', ok: 'Supprimer', danger: true })) {
      update((d) => ({ ...d, treatments: d.treatments.filter((t) => t.id !== treatment.id) }));
    }
  };

  const save = (values: Record<string, any>) => {
    const times = [...new Set(parseTimes(values.times) as string[])].sort();
    const item: Treatment = { id: editing?.id ?? uid(), name: values.name, dose: values.dose ?? '', times };
    update((d) => ({ ...d, treatments: editing ? d.treatments.map((t) => (t.id === item.id ? item : t)) : [...d.treatments, item] }));
    setEdit(null);
  };

  return (
    <Screen
      section="traitements"
      tab="main"
      speak={`Traitements. ${takenCount} prise sur ${doses.length} effectuée aujourd’hui.`}
      footer={<Btn label="Ajouter un traitement" icon="add" onPress={() => setEdit('new')} />}>
      <Header title="Traitements" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={() => dialog.alert('Aide', 'Cochez chaque prise une fois le médicament pris. Touchez un traitement pour le modifier. Les prises sont remises à zéro chaque jour.')} />} />
      <Hero title="Mes traitements" subtitle={frLong(todayISO())} />

      <View>
        <SectionTitle right={doses.length ? <T v="bodyBold" c={palette.ink}>{takenCount} / {doses.length}</T> : undefined}>Prises du jour</SectionTitle>
        {doses.length === 0 ? (
          <Empty icon="mc:pill" text="Aucune prise prévue. Ajoutez vos traitements pour suivre vos prises." />
        ) : (
          <Card pad={12} style={{ paddingVertical: 4 }}>
            {doses.map((dose, index) => {
              const taken = !!data.day.taken[dose.key];
              return (
                <View key={dose.key}>
                  {index > 0 && <Divider />}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: taken }}
                    accessibilityLabel={`${dose.treatment.name} à ${dose.time}`}
                    onPress={() => toggle(dose.key, !taken)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }, pressed && { opacity: 0.6 }]}>
                    <Pill label={dose.time} />
                    <View style={{ flex: 1 }}>
                      <T v="title" style={taken ? { textDecorationLine: 'line-through' } : undefined}>{dose.treatment.name}</T>
                      {!!dose.treatment.dose && <T v="small">{dose.treatment.dose}</T>}
                    </View>
                    <Check on={taken} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </View>

      {data.treatments.length > 0 && (
        <View>
          <SectionTitle>Mes médicaments</SectionTitle>
          <Card pad={12} style={{ paddingVertical: 4 }}>
            {data.treatments.map((treatment, index) => (
              <View key={treatment.id}>
                {index > 0 && <Divider />}
                <Pressable
                  onPress={() => setEdit(treatment)}
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier ${treatment.name}`}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }, pressed && { opacity: 0.6 }]}>
                  <Icon name="mc:pill" size={28} color={palette.ink} />
                  <View style={{ flex: 1 }}>
                    <T v="title">{treatment.name}</T>
                    <T v="small">{[treatment.dose, treatment.times.join(', ')].filter(Boolean).join(' • ')}</T>
                  </View>
                  <Icon name="chevron-forward" size={22} color={colors.title} />
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      )}

      <FormSheet
        visible={!!edit}
        title={editing ? 'Modifier le traitement' : 'Ajouter un traitement'}
        fields={FIELDS}
        initial={editing ? { ...editing, times: editing.times.join(', ') } : undefined}
        onClose={() => setEdit(null)}
        onSubmit={save}
        onDelete={editing ? () => remove(editing) : undefined}
      />
    </Screen>
  );
}
