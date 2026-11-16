import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { frLong, frToISO, isoToFr, normTime, todayISO, uid } from '../../lib';
import { type Appointment, useStore } from '../../store';
import { Btn, Card, CircleBtn, Empty, type FormField, FormSheet, Header, Hero, Icon, Pill, Screen, SectionTitle, T, useColors, useDialog } from '../../ui';

const FIELDS: FormField[] = [
  { key: 'title', label: 'Rendez-vous', required: true, placeholder: 'Ex. : Dr Bernard – Médecin traitant' },
  { key: 'date', label: 'Date', required: true, placeholder: 'JJ/MM/AAAA', maxLength: 10, validate: (value) => (frToISO(value) ? null : 'Date invalide. Format attendu : JJ/MM/AAAA.') },
  { key: 'time', label: 'Heure', required: true, placeholder: 'Ex. : 10h30', maxLength: 8, validate: (value) => (normTime(value) ? null : 'Heure invalide. Exemple : 10h30.') },
  { key: 'place', label: 'Lieu', placeholder: 'Ex. : Cabinet médical', maxLength: 160 },
];

export default function Agenda() {
  const { data, update } = useStore();
  const dialog = useDialog();
  const colors = useColors();
  const [edit, setEdit] = useState<Appointment | 'new' | null>(null);
  const editing = edit && edit !== 'new' ? edit : null;
  const today = todayISO();
  const sorted = [...data.appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const upcoming = sorted.filter((a) => a.date >= today);
  const past = sorted.filter((a) => a.date < today).reverse();

  const remove = async (appointment: Appointment) => {
    setEdit(null); // on ferme la fiche avant de demander confirmation
    if (await dialog.confirm({ title: 'Supprimer ce rendez-vous ?', message: `« ${appointment.title} » sera retiré de votre agenda.`, ok: 'Supprimer', danger: true })) {
      update((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== appointment.id) }));
    }
  };

  const save = (values: Record<string, any>) => {
    const item: Appointment = { id: editing?.id ?? uid(), title: values.title, date: frToISO(values.date)!, time: normTime(values.time)!, place: values.place ?? '' };
    update((d) => ({ ...d, appointments: editing ? d.appointments.map((a) => (a.id === item.id ? item : a)) : [...d.appointments, item] }));
    setEdit(null);
  };

  const card = (appointment: Appointment, faded?: boolean) => (
    <Card key={appointment.id} pad={12} style={faded ? { opacity: 0.7 } : undefined}>
      <Pressable
        onPress={() => setEdit(appointment)}
        accessibilityRole="button"
        accessibilityLabel={`${appointment.title}, ${frLong(appointment.date)} à ${appointment.time}`}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14 }, pressed && { opacity: 0.6 }]}>
        <Pill label={appointment.time} />
        <View style={{ flex: 1 }}>
          <T v="title">{appointment.title}</T>
          <T v="small">{appointment.date === today ? 'Aujourd’hui' : frLong(appointment.date)}</T>
          {!!appointment.place && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Icon name="location-outline" size={15} color={colors.muted} />
              <T v="small" style={{ flex: 1 }}>{appointment.place}</T>
            </View>
          )}
        </View>
        <Icon name="chevron-forward" size={22} color={colors.title} />
      </Pressable>
    </Card>
  );

  return (
    <Screen section="agenda" tab="main" speak={`Agenda. ${upcoming.length} rendez-vous à venir.`} footer={<Btn label="Ajouter un rendez-vous" icon="add" onPress={() => setEdit('new')} />}>
      <Header title="Agenda" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={() => dialog.alert('Aide', 'Retrouvez ici vos rendez-vous. Touchez un rendez-vous pour le modifier ou le supprimer.')} />} />
      <Hero title="Mon agenda" subtitle="Mes rendez-vous à venir" />

      <View>
        <SectionTitle>À venir</SectionTitle>
        <View style={{ gap: 10 }}>
          {upcoming.length === 0 && <Empty icon="calendar-outline" text="Aucun rendez-vous à venir." />}
          {upcoming.map((appointment) => card(appointment))}
        </View>
      </View>

      {past.length > 0 && (
        <View>
          <SectionTitle>Passés</SectionTitle>
          <View style={{ gap: 10 }}>{past.map((appointment) => card(appointment, true))}</View>
        </View>
      )}

      <FormSheet
        visible={!!edit}
        title={editing ? 'Modifier le rendez-vous' : 'Ajouter un rendez-vous'}
        fields={FIELDS}
        initial={editing ? { ...editing, date: isoToFr(editing.date), time: editing.time.replace(':', 'h') } : undefined}
        onClose={() => setEdit(null)}
        onSubmit={save}
        onDelete={editing ? () => remove(editing) : undefined}
      />
    </Screen>
  );
}
