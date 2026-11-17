import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cloudPath, decodeBase64, encodeBase64, mapAssets, MAX_CLOUD_PAYLOAD, MAX_CLOUD_PHOTO, parseCloudPayload, parseLocalData, photoDataUri } from '../src/cloud/payload';
import { parseLocalRecord } from '../src/cloud/local-record';
import type { Data } from '../src/state/types';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FILE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const URI = `cloud:${USER}/${FILE}.bin`;
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9);
const data = (): Data => ({
  profile: { firstName: 'Essai', lastName: '', age: '', city: '', address: '', phone: '', email: 'demo@example.fr', photo: URI },
  health: { antecedents: '', allergies: '', doctor: '', doctorPhone: '', bloodType: '' },
  proches: [{ id: 'p', name: 'Proche', relation: 'Ami', phone: '', primary: false, emergency: true, photo: 'seed:av_claire' }],
  docs: [{ id: 'd', name: 'Essai', category: 'administratif', kind: 'PDF', date: '2026-11-16', size: 20, uri: URI, encrypted: true }],
  notes: [{ id: 'n', title: 'Note', text: '', date: '2026-11-16' }], treatments: [{ id: 't', name: 'Essai', dose: '', times: ['08:00'] }],
  appointments: [{ id: 'a', title: 'Essai', date: '2026-11-17', time: '09:30', place: '' }],
  moods: [{ id: 'm', date: '2026-11-16', time: '10:30', mood: 'serein', source: 'manuel' }],
  links: [{ id: 'l', name: 'Exemple', url: 'https://example.org/' }],
  day: { date: '2026-11-16', waterMl: 0, meals: [{ id: 'meal', name: 'Essai', desc: '', done: false, photo: URI }], habits: [{ id: 'h', label: 'Essai', done: false }], taken: { 't@08:00': true } },
  waterGoalMl: 1500,
});
const payload = () => ({ v: 1, data: data(), changeId: 'change-1' });

describe('cloud : validation des instantanés et médias', () => {
  test('un instantané complet valide garde ses types et ses références propres au compte', () => {
    const raw = payload();
    assert.equal(parseCloudPayload(raw, USER), raw);
    assert.equal(cloudPath(URI, USER), `${USER}/${FILE}.bin`);
  });

  test('les chemins d’un autre compte, les traversées et les identifiants mal formés sont refusés', () => {
    for (const uri of [URI.replace(USER, OTHER), URI.replace(FILE, '../secret'), `cloud:${USER}/${'-'.repeat(36)}.bin`, `${URI}?download=true`, 'file:///private/file', 'https://example.org/image', 'data:image/jpeg;base64,/9j/']) {
      assert.throws(() => cloudPath(uri, USER));
      const raw = payload(); raw.data.profile.photo = uri;
      assert.throws(() => parseCloudPayload(raw, USER));
    }
    assert.throws(() => parseCloudPayload(payload(), 'invalid-user'));
  });

  test('les champs inattendus ne peuvent pas transporter des chemins locaux ou des fichiers cachés', () => {
    for (const mutate of [
      (raw: any) => { raw.hidden = 'file:///private/secret'; },
      (raw: any) => { raw.data.profile.hidden = 'data:application/pdf;base64,secret'; },
      (raw: any) => { raw.data.docs[0].encrypted = 'yes'; },
      (raw: any) => { raw.data.moods[0].source = 'external'; },
      (raw: any) => { raw.data.day.taken['bad'] = 'yes'; },
      (raw: any) => { raw.data.links[0].url = 'javascript:alert(1)'; },
      (raw: any) => { raw.data.notes[0].date = '2026-02-30'; },
      (raw: any) => { raw.data.appointments[0].time = '30:99'; },
      (raw: any) => { raw.data.treatments[0].times = new Array(1); },
    ]) {
      const raw = payload(); mutate(raw);
      assert.throws(() => parseCloudPayload(raw, USER));
    }
  });

  test('la limite de taille porte sur les octets UTF-8 et bloque avant la requête', () => {
    const raw = payload();
    raw.data.notes = Array.from({ length: 300 }, (_, index) => ({ id: `n${index}`, title: 'Essai', text: 'é'.repeat(4000), date: '2026-11-16' }));
    assert.ok(JSON.stringify(raw).length < MAX_CLOUD_PAYLOAD);
    assert.throws(() => parseCloudPayload(raw, USER), /CLOUD_DATA_TOO_LARGE/);
  });

  test('les conversions base64 couvrent les blocs longs sans accepter d’entrées mal formées', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, index) => index % 256);
    assert.deepEqual(decodeBase64(encodeBase64(bytes)), bytes);
    assert.deepEqual(decodeBase64(''), new Uint8Array());
    for (const value of ['abc', 'a===', '!!!!', 'YWJj\n', 'YW Jj', '====', 'Y=Jj']) assert.throws(() => decodeBase64(value));
    assert.throws(() => decodeBase64(encodeBase64(Uint8Array.of(1, 2, 3)), 2));
    assert.throws(() => decodeBase64('AA==', -1));
  });

  test('les photos sont limitées à un JPEG de 1 Mio et restent intégrées au cache chiffré', () => {
    assert.equal(photoDataUri(JPEG), `data:image/jpeg;base64,${encodeBase64(JPEG)}`);
    for (const bytes of [new Uint8Array(), Uint8Array.of(0xff, 0xd8), Uint8Array.of(0x89, 0x50, 0x4e, 0x47), new Uint8Array(MAX_CLOUD_PHOTO + 1)]) assert.throws(() => photoDataUri(bytes));
  });

  test('mapAssets est séquentiel et ne modifie pas les données sources', async () => {
    const local = data();
    local.profile.photo = 'file:///profile.jpg';
    local.notes[0].photo = 'blob:https://example.org/note';
    local.day.meals[0].photo = 'data:image/jpeg;base64,fake';
    local.docs[0].uri = 'file:///document.liora';
    const before = structuredClone(local);
    let active = 0;
    const calls: [string, boolean, boolean][] = [];
    const result = await mapAssets(local, async (uri, document, encrypted) => {
      active += 1; assert.equal(active, 1);
      await Promise.resolve();
      calls.push([uri, document, encrypted]);
      active -= 1;
      return `mapped:${uri}`;
    });
    assert.deepEqual(local, before);
    assert.deepEqual(calls, [['file:///profile.jpg', false, false], ['blob:https://example.org/note', false, false], ['data:image/jpeg;base64,fake', false, false], ['file:///document.liora', true, true]]);
    assert.equal(result.proches[0].photo, 'seed:av_claire');
    assert.equal(result.profile.photo, 'mapped:file:///profile.jpg');
    assert.equal(result.docs[0].encrypted, true);
    assert.notEqual(result.docs[0], local.docs[0]);
  });
});

describe('cloud : validation du cache local', () => {
  const local = () => {
    const value = data();
    value.profile.photo = photoDataUri(JPEG);
    value.day.meals[0].photo = 'file:///private/meal.jpg';
    value.docs[0].uri = 'blob:https://example.org/document';
    return { data: value, revision: 2, dirty: true, changeId: 'pending', attempt: { changeId: 'sent', revision: 2 } };
  };

  test('les données locales et la tentative d’envoi sont conservées pour la reprise', () => {
    const record = local();
    assert.equal(parseLocalRecord(record), record);
    assert.equal(parseLocalData(record.data), record.data);
    assert.throws(() => parseCloudPayload({ v: 1, data: record.data, changeId: 'pending' }, USER));
  });

  test('les métadonnées corrompues et les adresses distantes sont refusées avant synchronisation', () => {
    for (const mutate of [
      (value: any) => { value.revision = NaN; },
      (value: any) => { value.revision = -1; },
      (value: any) => { value.revision = Number.MAX_SAFE_INTEGER + 1; },
      (value: any) => { value.dirty = 'true'; },
      (value: any) => { value.changeId = ''; },
      (value: any) => { value.dirty = false; },
      (value: any) => { value.attempt.revision = 1; },
      (value: any) => { value.attempt.hidden = true; },
      (value: any) => { value.data.profile.photo = 'https://example.org/private.jpg'; },
      (value: any) => { value.data.profile.photo = URI; },
      (value: any) => { value.data.profile.photo = 'data:application/pdf;base64,AA=='; },
      (value: any) => { value.data.profile.photo = 'data:image/jpeg;base64,invalid'; },
    ]) {
      const record = local(); mutate(record);
      assert.throws(() => parseLocalRecord(record));
    }
  });
});
