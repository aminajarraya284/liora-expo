import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import type { CloudRequest } from '../src/cloud/transport';
import {
  createEmergencyService, normalizeEmergencyCode, parseEmergencyDocuments,
  parseEmergencyKey, parseEmergencyRequest, parseEmergencyState,
} from '../src/emergency/service';
import type { EmergencyDocuments, EmergencyKey, EmergencyRequest } from '../src/emergency/types';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REQUEST_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FILE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CODE = '0123456789ABCDEF0123456789ABCDEF';
const CODE_HASH = createHash('sha256').update(CODE).digest('hex');
const INPUT = { procheId: 'proche-1', recipientEmail: 'sophie@example.test', documentIds: ['doc-1'] };
const KEY: EmergencyKey = {
  id: KEY_ID, procheId: INPUT.procheId, procheName: 'Sophie', recipientEmail: INPUT.recipientEmail,
  documentIds: ['doc-1'], createdAt: '2026-11-17T10:00:00Z', revokedAt: null,
};
const REQUEST: EmergencyRequest = {
  id: REQUEST_ID, keyId: KEY_ID, ownerName: 'Alice', procheName: 'Sophie', reason: 'Retrouver les documents autorisés.',
  requestedAt: '2026-11-17T10:00:00Z', opensAt: '2026-11-19T10:00:00Z', expiresAt: '2026-11-20T10:00:00Z',
  status: 'waiting', role: 'recipient',
};
const DOCUMENTS: EmergencyDocuments = {
  ownerName: 'Alice', expiresAt: REQUEST.expiresAt,
  documents: [{ id: 'doc-1', name: 'Attestation', kind: 'PDF', size: 3, date: '2026-11-17', path: `${OWNER}/${FILE_ID}.bin` }],
};

type Call = { path: string; method: string | undefined; body: Record<string, unknown> | undefined; binary: boolean | undefined };
function harness(respond: (call: Call) => unknown | Promise<unknown>) {
  const calls: Call[] = [];
  const generated = { ids: 0, codes: 0, cancellations: 0 };
  const request: CloudRequest = async (path, method, body, binary) => {
    assert.ok(body === undefined || typeof body === 'string');
    const call = { path, method, body: typeof body === 'string' ? JSON.parse(body) as Record<string, unknown> : undefined, binary };
    calls.push(call);
    return respond(call);
  };
  const service = createEmergencyService({
    transport: {
      operation: async () => request,
      cancel: () => { generated.cancellations += 1; },
    },
    newId: () => { generated.ids += 1; return KEY_ID; },
    randomCode: async () => { generated.codes += 1; return CODE; },
    hash: async (value) => createHash('sha256').update(value).digest('hex'),
  });
  return { service, calls, generated };
}

describe('clé d’urgence : code, autorisation et téléchargement', () => {
  test('le code accepte les espaces et tirets sans accepter un code tronqué ou arbitraire', () => {
    assert.equal(normalizeEmergencyCode('0123-4567-89ab-cdef 0123-4567-89ab-cdef'), CODE);
    for (const code of ['', 'DEMO-48H', CODE.slice(1), `${CODE}0`, `${CODE.slice(0, -1)}G`, `${CODE}/`]) {
      assert.throws(() => normalizeEmergencyCode(code), /32 caractères/);
    }
  });

  test('la création et la demande transmettent uniquement le hachage du code', async () => {
    const { service, calls } = harness(({ path }) => path.endsWith('_create') ? KEY : REQUEST);
    const created = await service.create({ ...INPUT, recipientEmail: ' Sophie@Example.Test ' });
    assert.equal(created.code, '0123-4567-89AB-CDEF-0123-4567-89AB-CDEF');
    await service.request(created.code.toLowerCase(), '  Retrouver les documents autorisés.  ');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].body, {
      p_id: KEY_ID, p_proche_id: INPUT.procheId, p_recipient_email: INPUT.recipientEmail,
      p_document_ids: ['doc-1'], p_code_hash: CODE_HASH,
    });
    assert.deepEqual(calls[1].body, { p_code_hash: CODE_HASH, p_reason: REQUEST.reason });
    assert.equal(JSON.stringify(calls).includes(CODE), false);
    assert.ok(calls.every((call) => call.method === 'POST' && call.path.startsWith('/rest/v1/rpc/liora_emergency_')));
  });

  test('un accusé de création perdu réutilise le même identifiant et le même code au réessai', async () => {
    let first = true;
    const { service, calls, generated } = harness(() => {
      if (first) { first = false; throw new Error('CLOUD_REQUEST_FAILED'); }
      return KEY;
    });
    await assert.rejects(service.create(INPUT), /Action impossible/);
    const created = await service.create(INPUT);
    assert.equal(normalizeEmergencyCode(created.code), CODE);
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(generated.ids, 1);
    assert.equal(generated.codes, 1);
    await service.create(INPUT);
    assert.equal(generated.ids, 2);
    assert.equal(generated.codes, 2);
  });

  test('des saisies invalides ne déclenchent aucun appel au serveur', async () => {
    const { service, calls } = harness(() => KEY);
    for (const input of [
      { ...INPUT, recipientEmail: 'sans-adresse' }, { ...INPUT, procheId: '' },
      { ...INPUT, documentIds: [] }, { ...INPUT, documentIds: ['doc-1', 'doc-1'] },
      { ...INPUT, documentIds: Array.from({ length: 21 }, (_, index) => `doc-${index}`) },
    ]) await assert.rejects(service.create(input));
    await assert.rejects(service.request('DEMO-48H', REQUEST.reason));
    await assert.rejects(service.request(CODE, '   '));
    await assert.rejects(service.request(CODE, 'a'.repeat(501)));
    await assert.rejects(service.decide('../request', 'approve'));
    await assert.rejects(service.revoke('invalid'));
    await assert.rejects(service.documents('invalid'));
    assert.equal(calls.length, 0);
  });

  test('les réponses malformées sont rejetées avant d’être proposées à l’écran', () => {
    for (const value of [null, {}, { ...KEY, recipientEmail: 'invalide' }, { ...KEY, documentIds: ['doc-1', 'doc-1'] }, { ...KEY, revokedAt: 'hier' }]) {
      assert.throws(() => parseEmergencyKey(value), /illisible/);
    }
    for (const value of [null, {}, { ...REQUEST, status: 'anything' }, { ...REQUEST, role: 'admin' }, { ...REQUEST, opensAt: 'demain' }]) {
      assert.throws(() => parseEmergencyRequest(value), /illisible/);
    }
    for (const value of [null, {}, { serverNow: REQUEST.requestedAt, keys: [KEY], requests: [{}] }]) {
      assert.throws(() => parseEmergencyState(value), /illisible/);
    }
    assert.deepEqual(parseEmergencyState({ serverNow: REQUEST.requestedAt, keys: [KEY], requests: [REQUEST] }), {
      serverNow: REQUEST.requestedAt, keys: [KEY], requests: [REQUEST],
    });
  });

  test('les chemins absolus, traversées et fichiers arbitraires sont refusés avant le téléchargement', async () => {
    for (const path of [
      `https://evil.example/${OWNER}/${FILE_ID}.bin`, `/${OWNER}/${FILE_ID}.bin`,
      `${OWNER}/../${FILE_ID}.bin`, `${OWNER}/%2e%2e/${FILE_ID}.bin`,
      `${OWNER}/${FILE_ID}.bin?token=secret`, `${OWNER}/report.pdf`,
    ]) {
      const response = { ...DOCUMENTS, documents: [{ ...DOCUMENTS.documents[0], path }] };
      const { service, calls } = harness(() => response);
      await assert.rejects(service.download(REQUEST_ID, 'doc-1'), /illisible/);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].path.endsWith('_documents'));
    }
  });

  test('le bénéficiaire télécharge uniquement un document de la liste autorisée', async () => {
    const bytes = Uint8Array.of(1, 2, 3);
    const { service, calls } = harness(({ path }) => path.endsWith('_documents') ? DOCUMENTS : bytes);
    assert.deepEqual(await service.download(REQUEST_ID, 'doc-1'), { document: DOCUMENTS.documents[0], bytes });
    assert.deepEqual(calls, [
      { path: '/rest/v1/rpc/liora_emergency_documents', method: 'POST', body: { p_request_id: REQUEST_ID }, binary: undefined },
      { path: `/storage/v1/object/authenticated/liora-files/${OWNER}/${FILE_ID}.bin`, method: 'GET', body: undefined, binary: true },
    ]);
    await assert.rejects(service.download(REQUEST_ID, 'doc-interdit'), /plus accessible/);
    assert.equal(calls.length, 3);
    assert.equal(calls.filter((call) => call.path.startsWith('/storage/')).length, 1);
  });

  test('chaque nouvelle ouverture revérifie les droits et un refus bloque le téléchargement', async () => {
    let revoked = false;
    const { service, calls } = harness(({ path }) => {
      if (path.endsWith('_documents')) return revoked ? { error: 'UNAVAILABLE' } : DOCUMENTS;
      return Uint8Array.of(1, 2, 3);
    });
    await service.download(REQUEST_ID, 'doc-1');
    revoked = true;
    await assert.rejects(service.download(REQUEST_ID, 'doc-1'), /Code indisponible/);
    assert.equal(calls.filter((call) => call.path.endsWith('_documents')).length, 2);
    assert.equal(calls.filter((call) => call.path.startsWith('/storage/')).length, 1);
  });

  test('les métadonnées trop volumineuses et les fausses réponses binaires sont rejetées', async () => {
    assert.throws(() => parseEmergencyDocuments({
      ...DOCUMENTS, documents: [{ ...DOCUMENTS.documents[0], size: 20 * 1024 * 1024 + 1 }],
    }), /illisible/);
    assert.throws(() => parseEmergencyDocuments({
      ...DOCUMENTS, documents: [{ ...DOCUMENTS.documents[0], kind: '../PDF' }],
    }), /illisible/);
    const { service } = harness(({ path }) => path.endsWith('_documents') ? DOCUMENTS : { private: 'unexpected JSON' });
    await assert.rejects(service.download(REQUEST_ID, 'doc-1'), /illisible/);
  });

  test('la limitation des tentatives et les erreurs ne révèlent pas le contenu renvoyé par le serveur', async () => {
    const limited = harness(() => ({ error: 'RATE_LIMITED', details: 'secret-provider-info' }));
    await assert.rejects(limited.service.request(CODE, REQUEST.reason), (error: Error) =>
      /Trop de tentatives/.test(error.message) && !error.message.includes('secret-provider-info'));
    const unavailable = harness(() => ({ error: 'recipient alice@example.test does not match', details: 'secret-provider-info' }));
    await assert.rejects(unavailable.service.request(CODE, REQUEST.reason), (error: Error) =>
      /Code indisponible/.test(error.message) && !error.message.includes('alice@example.test'));
    const failed = harness(() => { throw new Error('CLOUD_REQUEST_FAILED'); });
    await assert.rejects(failed.service.list(), /Action impossible/);
  });

  test('les décisions et révocations transmettent uniquement leur cible et l’annulation ferme le transport', async () => {
    const { service, calls, generated } = harness(() => null);
    await service.decide(REQUEST_ID, 'deny');
    await service.revoke(KEY_ID);
    assert.deepEqual(calls.map((call) => call.body), [
      { p_request_id: REQUEST_ID, p_decision: 'deny' }, { p_key_id: KEY_ID },
    ]);
    service.cancel();
    assert.equal(generated.cancellations, 1);
  });
});
