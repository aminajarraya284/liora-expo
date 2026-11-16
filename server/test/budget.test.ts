import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { memoryBudget, redisBudget } from '../src/budget.ts';
import { loadConfig } from '../src/config.ts';

const BASE = { LIORA_APP_TOKEN: 'a'.repeat(32), LIORA_SESSION_SECRET: 'b'.repeat(32) };
const request = { kind: 'assistant' as const, device: 'test-device', deviceLimit: 2, globalLimit: 3 };

describe('budget partagé', () => {
  test('la production exige Redis et refuse une configuration partielle ou non HTTPS', () => {
    assert.throws(() => loadConfig({ ...BASE, NODE_ENV: 'production' }), /plafonds/);
    assert.throws(() => loadConfig({ ...BASE, LIORA_REDIS_REST_TOKEN: 'token' }), /ensemble/);
    for (const url of ['http://example.com', 'invalid', 'https://user:password@example.com', 'https://example.com/?token=x']) {
      assert.throws(() => loadConfig({ ...BASE, LIORA_REDIS_REST_URL: url, LIORA_REDIS_REST_TOKEN: 'token' }), /HTTPS/);
    }
    const config = loadConfig({ ...BASE, NODE_ENV: 'production', LIORA_REDIS_REST_URL: 'https://redis.example/', LIORA_REDIS_REST_TOKEN: 'token' });
    assert.equal(config.redisRestUrl, 'https://redis.example');
  });

  test('le mode local partage le total entre appareils et entre les deux fonctions', async () => {
    const budget = memoryBudget();
    assert.equal(await budget.take(request), 'allowed');
    assert.equal(await budget.take(request), 'allowed');
    assert.equal(await budget.take(request), 'device');
    assert.equal(await budget.take({ ...request, kind: 'mood' }), 'allowed');
    assert.equal(await budget.take({ ...request, device: 'another' }), 'global');
  });

  test('Redis reçoit une réservation atomique, sans identifiant brut et avec expiration', async () => {
    const fetchFn: typeof fetch = async (url, init) => {
      assert.equal(url, 'https://redis.example');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer secret');
      assert.equal(init?.redirect, 'error');
      const command = JSON.parse(String(init?.body)) as string[];
      assert.equal(command[0], 'EVAL');
      assert.equal(command[2], '2');
      assert.equal(command[3].includes(request.device), false);
      assert.equal(command[3].match(/\{[^}]+\}/)?.[0], command[4].match(/\{[^}]+\}/)?.[0]);
      assert.equal(command[5], '2');
      assert.equal(command[6], '3');
      const expiry = Number(command[7]);
      assert.ok(expiry > Date.now() / 1000 && expiry <= Date.now() / 1000 + 86_400);
      return Response.json({ result: 0 });
    };
    assert.equal(await redisBudget('https://redis.example', 'secret', fetchFn).take(request), 'allowed');
  });

  test('plafonds et erreurs Redis sont traités sans autorisation implicite', async () => {
    for (const [result, expected] of [[1, 'device'], [2, 'global']] as const) {
      assert.equal(await redisBudget('https://redis.example', 'secret', async () => Response.json({ result })).take(request), expected);
    }
    for (const response of [Response.json({ error: 'failure' }), Response.json({ result: 3 }), Response.json({ result: '0' }), Response.json(null), new Response('bad', { status: 503 })]) {
      await assert.rejects(redisBudget('https://redis.example', 'secret', async () => response).take(request), /BUDGET_UNAVAILABLE/);
    }
    await assert.rejects(redisBudget('https://redis.example', 'secret', async () => { throw new Error('offline'); }).take(request));
  });
});
