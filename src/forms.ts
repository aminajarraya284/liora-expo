import { isEmail, isPhone, uid } from './lib';
import type { Proche } from './store';
import type { FormField } from './ui';

const phone = (v: string) => (isPhone(v) ? null : 'Numéro de téléphone invalide.');
const email = (v: string) => (isEmail(v) ? null : 'Adresse e-mail invalide.');
const age = (v: string) => (/^\d{1,3}$/.test(v) && Number(v) > 0 && Number(v) < 130 ? null : 'Âge invalide.');

export const PROFILE_FIELDS: FormField[] = [
  { key: 'photo', label: 'Ajouter une photo', type: 'image' },
  { key: 'firstName', label: 'Prénom', required: true },
  { key: 'lastName', label: 'Nom' },
  { key: 'phone', label: 'Téléphone', type: 'phone', placeholder: '06 12 34 56 78', validate: phone },
  { key: 'email', label: 'E-mail de contact', type: 'email', validate: email },
];

export const PERSONAL_FIELDS: FormField[] = [
  { key: 'firstName', label: 'Prénom', required: true },
  { key: 'lastName', label: 'Nom' },
  { key: 'age', label: 'Âge', type: 'number', validate: age },
  { key: 'address', label: 'Adresse', type: 'multiline' },
  { key: 'city', label: 'Ville', placeholder: 'Votre ville' },
];

export const HEALTH_FIELDS: FormField[] = [
  { key: 'antecedents', label: 'Antécédents', type: 'multiline', placeholder: 'À remplir avec votre médecin' },
  { key: 'allergies', label: 'Allergies', placeholder: 'Ex. : pollen' },
  { key: 'bloodType', label: 'Groupe sanguin', placeholder: 'Ex. : A+' },
  { key: 'doctor', label: 'Médecin traitant', placeholder: 'Dr …' },
  { key: 'doctorPhone', label: 'Téléphone du médecin', type: 'phone', validate: phone },
];

export const PROCHE_FIELDS: FormField[] = [
  { key: 'photo', label: 'Ajouter une photo', type: 'image' },
  { key: 'name', label: 'Prénom', required: true },
  { key: 'relation', label: 'Lien', placeholder: 'Ex. : Ma fille', required: true },
  { key: 'phone', label: 'Téléphone', type: 'phone', placeholder: '06 12 34 56 78', required: true, validate: phone },
  { key: 'primary', label: 'Contact principal', type: 'bool' },
  { key: 'emergency', label: 'Contact d’urgence', type: 'bool' },
];

export function saveProche(list: Proche[], v: Record<string, any>, id?: string): Proche[] {
  const item: Proche = { id: id ?? uid(), name: v.name, relation: v.relation, phone: v.phone, primary: !!v.primary, emergency: !!v.emergency, photo: v.photo };
  let next = id ? list.map((p) => (p.id === id ? item : p)) : [...list, item];
  if (item.primary) next = next.map((p) => (p.id === item.id ? p : { ...p, primary: false }));
  return next;
}

