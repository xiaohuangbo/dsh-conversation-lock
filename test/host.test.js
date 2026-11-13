import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, Config } from '../host.js';

async function harness(options = {}) {
  const tools = new Map(), events = new Map(), tables = new Map(), submitted = [], followups = [], disposers = [];
  let spec, excluded;
  const routes = new Map();
  let global = { telemetryPrevious: null };
  const config = Config({});
  const own = { name: '@xiaohuangbo/dsh-conversation-lock', id: 'conversation-lock' };
  const telemetry = { name: '@deepseek-ai/dsh-session-telemetry-otel', id: 'telemetry' };
  const upload = { name: '@deepseek-ai/dsh-session-log-deepseek', id: 'upload' };
  let telemetryConfig = { mode: options.telemetryMode || 'FEEDBACK_ONLY', exporter: { url: 'https://collector.example.test' } };
  let ownConfig = {};
  const sessionSubmitted = [];
  const commands = new Map();
  const agents = new Map();
  function agentFor(id) {
    if (agents.has(id)) return agents.get(id);
    const agent = {
      id,
      ctx: { inject(names, fn) {
        if (!names.includes('commands')) return () => {};
        return fn({ commands: { register(definition) { const key = `${id}:${definition.name}`; commands.set(key, definition); const dispose = () => commands.delete(key); return dispose; } } });
      } },
      followup(message) { assert.equal(typeof message.id, 'string'); assert.equal(message.source.kind, 'user'); followups.push(message); },
    };
    agents.set(id, agent);
    return agent;
  }
  const ctx = {
    fiber: { entry: own },
    effect(fn) { const dispose = fn(); if (dispose) disposers.push(dispose); return dispose; },
    on(name, handler) { events.set(name, handler); return () => events.delete(name); },
    inject(names, fn) { fn({ sessionLogDeepSeek: { registerExclusion(fn) { excluded = fn; return async () => {}; } } }); },
    tools: { register(tool) { tools.set(tool.name, tool); } },
    commands: { find: () => undefined },
    agents: { get(id) { return agents.has(id) ? agents.get(id) : undefined; }, list() { return [...agents.values()]; } },
    get(key) {
      if (key === 'messageFeedback') return {
        async list() { return { ok: true, value: { items: [] } }; },
        async put(request) { submitted.push(request); return { ok: true, value: { ...request, version: 'v1' } }; },
      };
      if (key === 'sessionFeedback') return {
        async record(request) { sessionSubmitted.push(request); return { ok: true, value: { recorded: true } }; },
      };
      if (key === 'sessionTelemetry') return { sharing: telemetryConfig.mode === 'DISABLED' ? 'disabled' : 'feedback-only' };
    },
    connection: { fetch: { register(route) { assert.match(route.path, /^\/api\/conversation-lock\//); routes.set(route.path, route); return () => routes.delete(route.path); } } },
    configEditor: {
      entries() { return [own, telemetry, upload]; },
      configuration() { return [{ entry: telemetry, inherited: telemetryConfig, override: {} }]; },
      async edit(entry, change) {
        if (entry === telemetry) {
          if (options.failTelemetryWrite) throw new Error('Telemetry configuration is read-only');
          telemetryConfig = change(telemetryConfig);
        }
        if (entry === own) {
          ownConfig = change(ownConfig);
          // DSH volatile refs update in place.
          const next = Config(ownConfig);
          for (const key of Object.keys(next)) config[key] = next[key];
        }
      },
    },
    storageDomain: { async open(input) {
      spec = input;
      assert.match(spec.name, /^[a-z][a-z0-9_]*$/);
      assert.equal(spec.global.schema.safeParse(null).success, false);
      return {
        global: { get: () => global, async set(value) { global = spec.global.schema.parse(value); } },
        table(name) {
          if (!tables.has(name)) tables.set(name, new Map());
          const map = tables.get(name);
          return { get: key => map.get(key), entries: () => map.entries(), async put(key, value) { map.set(key, spec.tables[name].valueSchema.parse(value)); }, async delete(key) { map.delete(key); } };
        },
        async close() {},
      };
    } },
  };
  await apply(ctx, config);
  const created = events.get('agent/created');
  assert.equal(typeof created, 'function');
  created({ agent: agentFor('session-a') });
  const slash = async (id, rawInput) => {
    const definition = commands.get(`${id}:feedback`);
    assert.equal(typeof definition, 'object');
    return definition.handler({ agent: agentFor(id), rawInput, attachments: [], signal: new AbortController().signal });
  };
  const call = (name, args, id = 'session-a') => tools.get(name).execute(args, { agent: { id } });
  const remote = async (method, args) => {
    const response = await routes.get('/api/conversation-lock/' + method).fetch(new Request('http://localhost/api/conversation-lock/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload: args }) }));
    const { result } = await response.json();
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  return { call, slash, remote, tools, events, submitted, sessionSubmitted, commands, excluded: request => excluded(request), telemetry: () => telemetryConfig };
}

test('a disabled rating is rejected before any feedback write', async () => {
  const env = await harness();
  await env.call('conversation_lock_set', { feature: 'feedback', target: 'negative', enabled: true });
  await assert.rejects(env.remote('feedback', { sessionId: 'session-a', messageId: 'answer-1', rating: 'negative' }), /disabled/);
  assert.equal(env.submitted.length, 0);
  const ok = await env.remote('feedback', { sessionId: 'session-a', messageId: 'answer-1', rating: 'positive', note: 'fine' });
  assert.equal(ok.status, 'recorded');
  assert.equal(env.submitted.length, 1);
  assert.equal(env.submitted[0].rating, 'positive');
});
test('review is no longer offered as a feature', async () => {
  const env = await harness();
  await assert.rejects(env.call('conversation_lock_set', { feature: 'review', enabled: true }), /Unknown feature/);
  assert.deepEqual([...env.tools.keys()], ['conversation_lock_status', 'conversation_lock_set']);
});
test('/feedback shares the disabled-feedback policy', async () => {
  const env = await harness();
  assert.equal((await env.slash('session-a', 'Recording a remark.')).kind, 'success');
  assert.equal(env.sessionSubmitted.length, 1);
  await env.call('conversation_lock_set', { feature: 'feedback', target: 'negative', enabled: true });
  assert.equal((await env.slash('session-a', 'One side disabled still allowed.')).kind, 'success');
  assert.equal(env.sessionSubmitted.length, 2);
  await env.call('conversation_lock_set', { feature: 'feedback', target: 'positive', enabled: true });
  const blocked = await env.slash('session-a', 'Both sides disabled.');
  assert.equal(blocked.kind, 'error');
  assert.match(blocked.text, /disabled/);
  assert.equal(env.sessionSubmitted.length, 2);
});
test('privacy exclusions are session-specific and telemetry restores after the final release', async () => {
  const env = await harness();
  await env.call('conversation_lock_set', { feature: 'privacy', enabled: true });
  assert.equal(env.excluded({ sessionId: 'session-a' }), true);
  assert.equal(env.excluded({ sessionId: 'session-b' }), false);
  assert.equal(env.telemetry().mode, 'DISABLED');
  assert.equal(env.telemetry().exporter.url, 'https://collector.example.test');
  await env.call('conversation_lock_set', { feature: 'privacy', enabled: true }, 'session-b');
  await env.remote('release', { sessionId: 'session-a' });
  assert.equal(env.telemetry().mode, 'DISABLED');
  await env.remote('release', { sessionId: 'session-b' });
  assert.equal(env.telemetry().mode, 'FEEDBACK_ONLY');
});
test('closure refuses only the exact session and user switch releases enforcement', async () => {
  const env = await harness();
  await env.call('conversation_lock_set', { feature: 'conversation', enabled: true });
  const before = env.events.get('agent/pre-step');
  const next = () => ({ kind: 'enter', messages: [] });
  assert.deepEqual(await before({ agent: { id: 'session-a' } }, next), { kind: 'reject' });
  assert.equal((await before({ agent: { id: 'session-b' } }, next)).kind, 'enter');
  await env.remote('settings', { conversation: false });
  assert.equal((await before({ agent: { id: 'session-a' } }, next)).kind, 'enter');
  await assert.rejects(env.call('conversation_lock_set', { feature: 'conversation', enabled: true }), /disabled by the user/);
});
test('model tools never expose user-authorization mutation', async () => {
  const env = await harness();
  assert.deepEqual([...env.tools.keys()], ['conversation_lock_status', 'conversation_lock_set']);
  const status = await env.call('conversation_lock_status', {});
  assert.equal(status.sessionId, 'session-a');
  await assert.rejects(env.call('conversation_lock_set', { feature: 'language', enabled: true }), /Unknown feature/);
});
test('privacy never enables telemetry which was already disabled by the user', async () => {
  const env = await harness({ telemetryMode: 'DISABLED' });
  await env.call('conversation_lock_set', { feature: 'privacy', enabled: true });
  await env.call('conversation_lock_set', { feature: 'privacy', enabled: false });
  assert.equal(env.telemetry().mode, 'DISABLED');
});
test('failed telemetry write rolls back both session policy and restore marker', async () => {
  const env = await harness({ failTelemetryWrite: true });
  await assert.rejects(env.call('conversation_lock_set', { feature: 'privacy', enabled: true }), /read-only/);
  assert.equal((await env.call('conversation_lock_status', {})).policy.privacy, false);
  assert.equal((await env.remote('state', {})).telemetry.disabledByPlugin, false);
  assert.equal(env.excluded({ sessionId: 'session-a' }), false);
});
test('turning off privacy authorization restores telemetry and stops exclusions', async () => {
  const env = await harness();
  await env.call('conversation_lock_set', { feature: 'privacy', enabled: true });
  await env.remote('settings', { privacy: false });
  assert.equal(env.telemetry().mode, 'FEEDBACK_ONLY');
  assert.equal(env.excluded({ sessionId: 'session-a' }), false);
});
