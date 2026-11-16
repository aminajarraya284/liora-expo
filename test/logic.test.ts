import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ASSISTANT_TOOLS, CONFIRM_TOOLS } from '../shared/assistant-contract';
import { contextLine, type Message, runTurn } from '../src/features/assistant/agent';
import { checkToolInput } from '../src/features/assistant/schema';
import { createToolRunner } from '../src/features/assistant/tools';
import { resolveLink } from '../src/features/links/resolve';
import { buildMoodAdvice, isLowPeriod } from '../src/features/mood/advice';
import { articleUrl, mergeNews, type NewsItem, parseFeed, plainText, sinceLabel } from '../src/features/news/parse';
import { DAILY_IDEAS, dailyIdea, type Session, sessionMinutes, sessionSeconds, stepAt } from '../src/features/relax/logic';
import { utf8Decode, utf8Encode, constantTimeEqual, toHex } from '../src/security/utf8';
import type { Data } from '../src/state/types';
import { addDays, frLong, frToISO, isISODate, normTime, todayISO } from '../src/utils/dates';
import { fmtLitres, fmtSize } from '../src/utils/format';
import { isEmail, isPhone, normalizeUrlInput, parseHttpsUrl, passwordError } from '../src/utils/validation';

/** Tests de la logique pure : aucun écran, aucun réseau, aucun appel réel au modèle. */

const today = todayISO();

const sampleData = (): Data => ({
  profile: { firstName: 'Claire', lastName: 'Martin', age: '72', city: 'Lyon', address: '12 rue des Lilas', phone: '06 12 34 56 78', email: 'c@example.fr' },
  health: { antecedents: 'Hypertension', allergies: 'Pénicilline', doctor: 'Dr Bernard', doctorPhone: '04 72 00 00 00', bloodType: 'A+' },
  proches: [{ id: 'p1', name: 'Sophie', relation: 'Ma fille', phone: '06 11 22 33 44', primary: true, emergency: true }],
  docs: [{ id: 'd1', name: 'Ordonnance secrète', category: 'ordonnances', size: 10, kind: 'PDF', date: today }],
  notes: [],
  treatments: [{ id: 't1', name: 'Metformine', dose: '500 mg', times: ['08:00', '20:00'] }],
  appointments: [{ id: 'a1', title: 'Dentiste', date: addDays(today, 2), time: '10:00', place: 'Lyon' }],
  moods: [],
  links: [{ id: 'l1', name: 'Ma mutuelle', url: 'https://www.ma-mutuelle.fr/' }],
  day: { date: today, waterMl: 500, meals: [], habits: [], taken: {} },
  waterGoalMl: 1500,
});

function toolBench(confirmAnswer = true) {
  let data = sampleData();
  const calls = { confirm: 0, opened: [] as string[], called: [] as string[] };
  let n = 0;
  const run = createToolRunner({
    getData: () => data,
    update: (change) => { data = change(data); },
    confirm: async () => { calls.confirm += 1; return confirmAnswer; },
    open: (href) => { calls.opened.push(href); },
    call: async (phone) => { calls.called.push(phone); return true; },
    newId: () => `id${++n}`,
  });
  return { run, calls, data: () => data };
}

describe('dates et formats', () => {
  test('dates françaises', () => {
    assert.equal(frLong('2025-04-15'), 'Mardi 15 avril 2025');
    assert.equal(frLong('2026-12-01'), 'Mardi 1er décembre 2026');
    assert.equal(frToISO('15/04/2025'), '2025-04-15');
    assert.equal(frToISO('31/02/2027'), null);
    assert.equal(isISODate('2026-02-30'), false);
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });
  test('heures', () => {
    assert.equal(normTime('8h'), '08:00');
    assert.equal(normTime('12h30'), '12:30');
    assert.equal(normTime('25h'), null);
    assert.equal(normTime('abc'), null);
  });
  test('tailles et litres', () => {
    assert.equal(fmtSize(248 * 1024), '248 Ko');
    assert.equal(fmtLitres(1450), '1,45 L');
    assert.equal(fmtLitres(1200), '1,2 L');
  });
});

describe('validation des saisies', () => {
  test('e-mail, téléphone, mot de passe', () => {
    assert.ok(isEmail('claire@example.fr'));
    assert.ok(!isEmail('claire@'));
    assert.ok(isPhone('06 12 34 56 78'));
    assert.ok(!isPhone('abc'));
    assert.equal(passwordError('motdepasse1'), null);
    assert.ok(passwordError('court1'));
    assert.ok(passwordError('sanschiffre'));
  });
  test('seules les adresses https vers un nom de domaine sont acceptées', () => {
    assert.equal(parseHttpsUrl('https://www.ameli.fr/')?.host, 'www.ameli.fr');
    assert.equal(parseHttpsUrl(normalizeUrlInput('ma-mutuelle.fr'))?.host, 'ma-mutuelle.fr');
    for (const bad of ['http://www.ameli.fr', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'https://192.168.1.1/', 'https://ameli.fr@evil.example/', 'https://evil.example\\@ameli.fr', 'https:///x', 'ameli']) {
      assert.equal(parseHttpsUrl(bad), null, bad);
    }
  });
  test('le navigateur n’ouvre que les sites de la liste ou les liens enregistrés', () => {
    const saved = sampleData().links;
    assert.equal(resolveLink('ameli', saved)?.url, 'https://www.ameli.fr/');
    assert.equal(resolveLink('l1', saved)?.url, 'https://www.ma-mutuelle.fr/');
    assert.equal(resolveLink('https://evil.example', saved), null);
    assert.equal(resolveLink(undefined, saved), null);
    assert.equal(resolveLink('l1', [{ id: 'l1', name: 'x', url: 'http://non-securise.fr' }]), null);
  });
});

describe('chiffrement : conversions', () => {
  test('texte ⇄ octets, avec accents et émojis', () => {
    for (const text of ['', 'Bonjour', 'Élise – cœur à 37,5 °C', 'Joie 😀 et 👩‍👧', 'a'.repeat(10000) + 'é']) {
      assert.equal(utf8Decode(utf8Encode(text)), text);
      assert.deepEqual([...utf8Encode(text)], [...new TextEncoder().encode(text)]);
    }
  });
  test('hexadécimal et comparaison', () => {
    assert.equal(toHex(Uint8Array.from([0, 15, 255])), '000fff');
    assert.ok(constantTimeEqual('abc', 'abc'));
    assert.ok(!constantTimeEqual('abc', 'abd'));
    assert.ok(!constantTimeEqual('abc', 'abcd'));
  });
});

describe('humeur : messages', () => {
  const entry = (daysAgo: number, mood: any) => ({ date: addDays(today, -daysAgo), mood });
  test('le message varie d’une fois sur l’autre et propose des gestes adaptés', () => {
    const a = buildMoodAdvice(entry(0, 'fatigue'), [], 'soir', 0, true);
    const b = buildMoodAdvice(entry(0, 'fatigue'), [], 'soir', 1, true);
    assert.notEqual(a.message, b.message);
    assert.deepEqual(a.actions, ['sommeil', 'eau', 'respiration']);
    assert.match(a.closing ?? '', /nuit de sommeil/);
    assert.equal(a.showHelpline, false);
  });
  test('la tristesse rappelle le numéro d’écoute ; sans proche, on ne propose pas d’appel', () => {
    const advice = buildMoodAdvice(entry(0, 'triste'), [], 'matin', 0, false);
    assert.equal(advice.showHelpline, true);
    assert.ok(!advice.actions.includes('appeler'));
  });
  test('une amélioration est saluée', () => {
    assert.match(buildMoodAdvice(entry(0, 'serein'), [entry(1, 'triste')], 'matin', 0, true).lead ?? '', /mieux/);
  });
  test('plusieurs jours difficiles : on encourage à demander de l’aide', () => {
    const previous = [entry(2, 'triste'), entry(1, 'inquiet')];
    assert.ok(isLowPeriod(entry(0, 'fatigue'), previous));
    const advice = buildMoodAdvice(entry(0, 'fatigue'), previous, 'matin', 0, true);
    assert.match(advice.lead ?? '', /médecin/);
    assert.equal(advice.showHelpline, true);
    assert.ok(!isLowPeriod(entry(0, 'fatigue'), [entry(1, 'joyeux')]));
  });
  test('aucun message ne contient d’adjectif accordé visant la personne', () => {
    for (const mood of ['joyeux', 'serein', 'neutre', 'fatigue', 'inquiet', 'triste'] as const) {
      for (let variant = 0; variant < 4; variant++) {
        const { message } = buildMoodAdvice(entry(0, mood), [], 'matin', variant, true);
        assert.doesNotMatch(message, /\b(fatigué|fatiguée|seul|seule|inquiet|inquiète|prêt|prête)\b/i, message);
      }
    }
  });
});

describe('assistant : vérification des arguments', () => {
  const spec = (name: string) => ASSISTANT_TOOLS.find((t) => t.name === name)!;
  test('arguments conformes acceptés, tout le reste refusé', () => {
    assert.equal(checkToolInput(spec('ajouter_eau'), { verres: 2 }), null);
    assert.ok(checkToolInput(spec('ajouter_eau'), { verres: 99 }));
    assert.ok(checkToolInput(spec('ajouter_eau'), { verres: '2' }));
    assert.ok(checkToolInput(spec('ajouter_eau'), { verres: 2, autre: 1 }));
    assert.ok(checkToolInput(spec('ajouter_eau'), {}));
    assert.ok(checkToolInput(spec('ajouter_eau'), null));
    assert.ok(checkToolInput(spec('consulter'), { rubrique: 'coffre-fort' }));
    assert.ok(checkToolInput(spec('ajouter_traitement'), { nom: 'x', dose: '', heures: [8] }));
  });
  test('chaque outil est strict : tous les champs obligatoires, aucun champ en plus', () => {
    for (const tool of ASSISTANT_TOOLS) {
      assert.equal(tool.strict, true);
      assert.equal(tool.input_schema.additionalProperties, false);
      assert.deepEqual([...tool.input_schema.required], Object.keys(tool.input_schema.properties));
    }
  });
});

describe('assistant : actions sur le téléphone', () => {
  test('la lecture ne donne ni téléphone, ni adresse, ni document du coffre-fort', async () => {
    const { run } = toolBench();
    let all = '';
    for (const rubrique of ['traitements', 'agenda', 'proches', 'journal', 'nutrition', 'humeur', 'sante', 'profil']) {
      const out = await run('consulter', { rubrique });
      assert.ok(out.ok, rubrique);
      all += out.result;
    }
    assert.match(all, /Metformine/);
    assert.match(all, /Sophie/);
    assert.doesNotMatch(all, /06 11 22 33 44|06 12 34 56 78|rue des Lilas|Ordonnance secrète|c@example\.fr/);
  });
  test('les actions importantes demandent l’accord ; un refus ne modifie rien', async () => {
    const inputs: Record<string, unknown> = {
      ajouter_rendez_vous: { titre: 'Kiné', date: addDays(today, 5), heure: '09:00', lieu: '' },
      supprimer_rendez_vous: { id: 'a1' },
      ajouter_traitement: { nom: 'Doliprane', dose: '1 g', heures: ['08:00'] },
      marquer_prise: { traitement_id: 't1', heure: '08:00', prise: true },
      ajouter_note: { titre: 'Visite', texte: 'Un bon moment.' },
    };
    assert.deepEqual(Object.keys(inputs).sort(), [...CONFIRM_TOOLS].sort());
    for (const [name, input] of Object.entries(inputs)) {
      const refused = toolBench(false);
      const before = JSON.stringify(refused.data());
      const out = await refused.run(name, input);
      assert.equal(refused.calls.confirm, 1, name);
      assert.equal(JSON.stringify(refused.data()), before, name);
      assert.match(out.result, /refusé/);
      const accepted = toolBench(true);
      assert.ok((await accepted.run(name, input)).ok, name);
      assert.notEqual(JSON.stringify(accepted.data()), before, name);
    }
  });
  test('les actions simples s’exécutent sans confirmation', async () => {
    const bench = toolBench();
    assert.match((await bench.run('ajouter_eau', { verres: 2 })).result, /1000/);
    assert.ok((await bench.run('enregistrer_humeur', { humeur: 'serein' })).ok);
    assert.ok((await bench.run('appeler_proche', { proche_id: 'p1' })).ok);
    assert.ok((await bench.run('ouvrir_ecran', { ecran: 'respiration' })).ok);
    assert.equal(bench.calls.confirm, 0);
    assert.equal(bench.data().moods.length, 1);
    assert.deepEqual(bench.calls.called, ['06 11 22 33 44']);
    assert.deepEqual(bench.calls.opened, ['/seance?type=respiration']);
  });
  test('dates, heures et identifiants invalides sont refusés sans rien modifier', async () => {
    const bench = toolBench();
    const before = JSON.stringify(bench.data());
    const bad: [string, unknown][] = [
      ['ajouter_rendez_vous', { titre: 'x', date: '2026-02-31', heure: '09:00', lieu: '' }],
      ['ajouter_rendez_vous', { titre: 'x', date: addDays(today, 1), heure: '25:00', lieu: '' }],
      ['ajouter_rendez_vous', { titre: '   ', date: addDays(today, 1), heure: '09:00', lieu: '' }],
      ['supprimer_rendez_vous', { id: 'inconnu' }],
      ['marquer_prise', { traitement_id: 't1', heure: '12:00', prise: true }],
      ['ajouter_traitement', { nom: 'x', dose: '', heures: [] }],
      ['appeler_proche', { proche_id: 'inconnu' }],
      ['outil_inexistant', {}],
    ];
    for (const [name, input] of bad) assert.equal((await bench.run(name, input)).ok, false, name);
    assert.equal(JSON.stringify(bench.data()), before);
    assert.equal(bench.calls.confirm, 0);
  });
  test('les textes reçus sont nettoyés et bornés', async () => {
    const bench = toolBench();
    await bench.run('ajouter_note', { titre: `  Trop   long ${'x'.repeat(500)}`, texte: 'y'.repeat(5000) });
    const note = bench.data().notes[0];
    assert.ok(note.title.length <= 120 && note.text.length <= 2000);
    assert.ok(note.title.startsWith('Trop long'));
  });
});

describe('assistant : boucle de conversation', () => {
  const text = (value: string) => ({ type: 'text', text: value });
  const call = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input });
  const thinking = { type: 'thinking', thinking: '', signature: 'sig' };

  test('réponse simple : la conversation est conservée telle quelle', async () => {
    const sent: Message[][] = [];
    const turn = await runTurn({
      history: [], context: '[ctx]', userText: 'Bonjour',
      send: async (messages) => { sent.push(structuredClone(messages)); return { content: [thinking, text('Bonjour Claire !')], stop_reason: 'end_turn' }; },
      runTool: async () => ({ ok: true, result: '' }),
    });
    assert.equal(turn.end, 'done');
    assert.equal(turn.reply, 'Bonjour Claire !');
    assert.deepEqual(sent[0][0], { role: 'user', content: [text('[ctx]'), text('Bonjour')] });
    assert.deepEqual(turn.messages[1], { role: 'assistant', content: [thinking, text('Bonjour Claire !')] });
  });

  test('outils : résultats regroupés dans un seul message, erreurs signalées, blocs du modèle inchangés', async () => {
    const replies = [
      { content: [thinking, call('u1', 'consulter', { rubrique: 'agenda' }), call('u2', 'ajouter_eau', { verres: 9 })], stop_reason: 'tool_use' },
      { content: [text('Voilà.')], stop_reason: 'end_turn' },
    ];
    const sent: Message[][] = [];
    const actions: string[] = [];
    const bench = toolBench();
    const turn = await runTurn({
      history: [], context: '[ctx]', userText: 'Mes rendez-vous ?',
      send: async (messages) => { sent.push(structuredClone(messages)); return replies[sent.length - 1]; },
      runTool: bench.run,
      onAction: (summary) => actions.push(summary),
    });
    assert.equal(turn.reply, 'Voilà.');
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[1][1], { role: 'assistant', content: replies[0].content });
    const results = sent[1][2].content as any[];
    assert.equal(results.length, 2);
    assert.deepEqual(results.map((r) => [r.type, r.tool_use_id, !!r.is_error]), [['tool_result', 'u1', false], ['tool_result', 'u2', true]]);
    assert.match(results[0].content, /Dentiste/);
    assert.deepEqual(actions, []);
  });

  test('refus, réponse coupée avec outil et excès d’étapes : la conversation revient à son état précédent', async () => {
    const history: Message[] = [{ role: 'user', content: 'avant' }, { role: 'assistant', content: 'réponse' }];
    let ran = 0;
    const base = { history, context: '[ctx]', userText: 'x', runTool: async () => { ran += 1; return { ok: true, result: 'ok' }; } };
    const refused = await runTurn({ ...base, send: async () => ({ content: [], stop_reason: 'refusal' }) });
    assert.deepEqual([refused.end, refused.messages], ['refused', history]);
    const cut = await runTurn({ ...base, send: async () => ({ content: [call('u1', 'ajouter_eau', { verres: 1 })], stop_reason: 'max_tokens' }) });
    assert.deepEqual([cut.end, cut.messages], ['truncated', history]);
    assert.equal(ran, 0);
    const endless = await runTurn({ ...base, send: async () => ({ content: [call('u1', 'ajouter_eau', { verres: 1 })], stop_reason: 'tool_use' }) });
    assert.deepEqual([endless.end, endless.messages], ['too_long', history]);
    assert.ok(ran > 0 && ran <= 9);
  });

  test('une panne du réseau remonte à l’écran', async () => {
    await assert.rejects(runTurn({ history: [], context: '', userText: 'x', send: async () => { throw new Error('offline'); }, runTool: async () => ({ ok: true, result: '' }) }));
  });

  test('ligne de contexte', () => {
    assert.equal(contextLine(new Date(2026, 10, 10), '2026-11-10', '21:05', 'Claire'), '[Contexte ajouté par l’application — date : mardi 2026-11-10, heure : 21:05, prénom : Claire]');
  });
});

describe('relaxation : déroulement des séances', () => {
  const base = { title: '', summary: '', intro: '', outro: '' };
  const breathing: Session = { ...base, loopMinutes: 5, steps: [{ text: 'Inspirez', seconds: 4, grow: true }, { text: 'Expirez', seconds: 6, grow: false }] };
  const guided: Session = { ...base, steps: [{ text: 'a', seconds: 50 }, { text: 'b', seconds: 50 }, { text: 'c', seconds: 50 }] };

  test('durée : la respiration suit sa durée, la séance guidée la somme de ses étapes', () => {
    assert.equal(sessionSeconds(breathing), 300);
    assert.equal(sessionSeconds(guided), 150);
    assert.equal(sessionMinutes(guided), 3);
  });

  test('la respiration répète ses étapes', () => {
    assert.deepEqual(stepAt(breathing, 0), { index: 0, inStep: 0 });
    assert.deepEqual(stepAt(breathing, 5), { index: 1, inStep: 1 });
    assert.deepEqual(stepAt(breathing, 10), { index: 0, inStep: 0 });
  });

  test('la séance guidée se déroule une fois et reste sur la dernière étape', () => {
    assert.deepEqual(stepAt(guided, 49), { index: 0, inStep: 49 });
    assert.deepEqual(stepAt(guided, 50), { index: 1, inStep: 0 });
    assert.deepEqual(stepAt(guided, 150), { index: 2, inStep: 50 });
    assert.deepEqual(stepAt(guided, 999), { index: 2, inStep: 50 });
  });

  test('idée du jour : la même toute la journée, une autre le lendemain', () => {
    assert.equal(dailyIdea('2026-11-15'), dailyIdea('2026-11-15'));
    assert.notEqual(dailyIdea('2026-11-15'), dailyIdea('2026-11-16'));
    assert.ok(DAILY_IDEAS.includes(dailyIdea('1969-12-25') as (typeof DAILY_IDEAS)[number]));
  });
});

describe('actualités : lecture des flux', () => {
  const feed = (items: string) => `<?xml version="1.0"?><rss><channel><title>Flux</title>${items}</channel></rss>`;
  const item = (title: string, link: string, extra = '') => `<item><title>${title}</title><link>${link}</link>${extra}</item>`;

  test('un article normal est lu, texte nettoyé', () => {
    const xml = feed(item('<![CDATA[L&#039;été sera chaud &amp; sec]]>', 'https://www.francetvinfo.fr/meteo/article_1.html', '<description><![CDATA[<p>Un <b>été</b> chaud.</p><img src="x">]]></description><pubDate>Sun, 15 Nov 2026 08:00:00 +0100</pubDate>'));
    const [news] = parseFeed(xml, 'franceinfo');
    assert.equal(news.title, "L'été sera chaud & sec");
    assert.equal(news.summary, 'Un été chaud.');
    assert.equal(news.url, 'https://www.francetvinfo.fr/meteo/article_1.html');
    assert.equal(news.time, Date.parse('2026-11-15T07:00:00Z'));
    assert.match(news.id, /^franceinfo-[a-z0-9]+$/);
  });

  test('aucune balise ne survit, même cachée dans des entités', () => {
    assert.equal(plainText('&lt;script&gt;alert(1)&lt;/script&gt;Bonjour', 100), 'Bonjour');
    assert.equal(plainText('&amp;lt;img onerror=x&amp;gt; Titre', 100), 'Titre');
    assert.equal(plainText('a\u202eb\u0000c', 100), 'a b c');
    assert.ok(!/[<>]/.test(plainText('1 < 2 > 0 <b', 100)));
  });

  test('un texte trop long est coupé proprement', () => {
    const cut = plainText('mot '.repeat(200), 60);
    assert.ok(cut.length <= 60 && cut.endsWith('…'));
  });

  test('seuls les liens https vers le site de la source sont gardés', () => {
    assert.equal(articleUrl('https://fr.news.yahoo.com/article-1.html', 'yahoo'), 'https://fr.news.yahoo.com/article-1.html');
    assert.equal(articleUrl('https://www.franceinfo.fr/a', 'franceinfo'), 'https://www.franceinfo.fr/a');
    for (const bad of ['http://www.francetvinfo.fr/a', 'javascript:alert(1)', 'https://evil.example/a', 'https://francetvinfo.fr.evil.example/a', 'https://evilfrancetvinfo.fr/a', 'https://user@www.francetvinfo.fr/a', 'https://www.francetvinfo.fr/a b', 'https://192.168.1.1/a', '//www.francetvinfo.fr/a']) {
      assert.equal(articleUrl(bad, 'franceinfo'), null, bad);
    }
    assert.equal(articleUrl('https://www.francetvinfo.fr/a', 'yahoo'), null);
  });

  test('les articles douteux sont écartés, les doublons aussi, et le nombre est limité', () => {
    const many = Array.from({ length: 30 }, (_, i) => item(`Titre ${i}`, `https://fr.news.yahoo.com/a${i}`)).join('');
    assert.equal(parseFeed(feed(many), 'yahoo').length, 12);
    const xml = feed(item('Bon', 'https://fr.news.yahoo.com/a') + item('Bon', 'https://fr.news.yahoo.com/a') + item('', 'https://fr.news.yahoo.com/b') + item('Piège', 'https://evil.example/c'));
    assert.deepEqual(parseFeed(xml, 'yahoo').map((n) => n.title), ['Bon']);
    assert.deepEqual(parseFeed('pas du xml', 'yahoo'), []);
    assert.deepEqual(parseFeed('x'.repeat(2_000_001), 'yahoo'), []);
  });

  test('fusion : le plus récent d’abord, sans deux fois le même titre', () => {
    const n = (id: string, title: string, time: number): NewsItem => ({ id, source: 'yahoo', title, summary: '', url: 'https://fr.news.yahoo.com/x', time });
    const merged = mergeNews([[n('a', 'Ancien', 1), n('b', 'Même titre !', 5)], [n('c', 'Récent', 9), n('d', 'même titre', 3)]]);
    assert.deepEqual(merged.map((x) => x.id), ['c', 'b', 'a']);
  });

  test('ancienneté en clair', () => {
    const now = Date.parse('2026-11-15T12:00:00Z');
    assert.equal(sinceLabel(now - 30_000, now), 'à l’instant');
    assert.equal(sinceLabel(now - 25 * 60_000, now), 'il y a 25 min');
    assert.equal(sinceLabel(now - 3 * 3600_000, now), 'il y a 3 h');
    assert.equal(sinceLabel(now - 30 * 3600_000, now), 'hier');
    assert.equal(sinceLabel(0, now), '');
  });
});
