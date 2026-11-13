import z from '@deepseek-ai/schemastery';
import { z as Z } from 'zod';
import { FEATURES, EMPTY_POLICY, effective, changePolicy } from './policy.js';

export const name = 'conversation-lock';
export const HOST_BUILD = '1.1.0';
export const inject = ['tools', 'commands', 'connection', 'webServer', 'storageDomain', 'agents', 'configEditor'];
export const Config = z.object({
  conversation: z.boolean().default(true).volatile(),
  feedback: z.boolean().default(true).volatile(),
  stop: z.boolean().default(true).volatile(),
  privacy: z.boolean().default(true).volatile(),
  copy: z.boolean().default(true).volatile(),
  language: z.union(['auto', 'zh', 'en']).default('auto').volatile(),
});

export async function apply(ctx, config) {
  const domain = await ctx.storageDomain.open({
    name: 'conversation_lock', version: 1, layout: 'per-record',
    global: { schema: Z.object({ telemetryPrevious: Z.enum(['FEEDBACK_ONLY', 'DISABLED']).nullable(), uploadPrevious: Z.boolean().nullable().default(null) }), initial: { telemetryPrevious: null, uploadPrevious: null } },
    tables: {
      // `review` is kept only so 1.0.x session records still validate; the feature is gone.
      policies: { valueSchema: Z.object({ closed: Z.boolean(), until: Z.number().nullable(), reason: Z.string(), positive: Z.boolean(), negative: Z.boolean(), stop: Z.boolean(), review: Z.boolean(), privacy: Z.boolean(), copy: Z.boolean() }) },
    },
  });
  ctx.effect(() => () => domain.close());
  const policies = domain.table('policies');
  const value = key => typeof config[key]?.get === 'function' ? config[key].get() : config[key];
  const features = () => Object.fromEntries(FEATURES.map(key => [key, value(key)]));
  const policy = id => effective(policies.get(id), features());
  let revision = 0;
  let queue = Promise.resolve();
  const serial = fn => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  // Loader rows are addressed by patch id or by module specifier depending on
  // how the profile inserted them, so match any of the identities the entry
  // exposes instead of guessing one field.
  const entryIdentities = entry => [entry?.name, entry?.id, entry?.entryId, entry?.moduleName, entry?.path]
    .filter(value => typeof value === 'string');
  const findConfigEntry = (...keys) => ctx.configEditor.entries().find(entry => {
    const identities = entryIdentities(entry);
    return keys.some(key => identities.some(value => value === key || value.includes(key)));
  });
  const telemetryEntry = () => findConfigEntry('@deepseek-ai/dsh-session-telemetry-otel', 'session-telemetry-otel');
  const uploadEntry = () => findConfigEntry('@deepseek-ai/dsh-session-log-deepseek', 'session-log-deepseek');
  const currentUploadEnabled = entry => {
    const row = ctx.configEditor.configuration().find(item => item.entry === entry || item.entry?.options?.id === entry?.options?.id);
    return (row?.override?.enabled ?? row?.inherited?.enabled ?? true) !== false;
  };
  async function syncTelemetry() {
    const required = [...policies.entries()].some(([id]) => policy(id).privacy);
    let stored = domain.global.get();
    // 1. Session OTel: disabled while any privacy restriction is active.
    const telemetry = telemetryEntry();
    if (telemetry) {
      if (required) {
        const first = stored.telemetryPrevious === null;
        if (first) {
          const row = ctx.configEditor.configuration().find(row => row.entry === telemetry || row.entry?.options?.id === telemetry?.options?.id);
          const prior = ctx.get('sessionTelemetry')?.sharing === 'disabled' ? 'DISABLED' : row?.override?.mode ?? row?.inherited?.mode ?? 'FEEDBACK_ONLY';
          stored = { ...stored, telemetryPrevious: prior === 'DISABLED' ? 'DISABLED' : 'FEEDBACK_ONLY' };
          await domain.global.set(stored);
        }
        try { await ctx.configEditor.edit(telemetry, current => ({ ...current, mode: 'DISABLED' })); }
        catch (error) {
          if (first) { stored = { ...stored, telemetryPrevious: null }; await domain.global.set(stored); }
          throw error;
        }
      } else if (stored.telemetryPrevious !== null) {
        await ctx.configEditor.edit(telemetry, current => ({ ...current, mode: stored.telemetryPrevious }));
        stored = { ...stored, telemetryPrevious: null };
        await domain.global.set(stored);
      }
    }
    // 2. Official API Session Log upload: switched off and locked while a
    //    privacy restriction is active, restored to the user's own value after.
    const upload = uploadEntry();
    if (upload) {
      if (required) {
        const first = stored.uploadPrevious === null;
        if (first) {
          stored = { ...stored, uploadPrevious: currentUploadEnabled(upload) };
          await domain.global.set(stored);
        }
        try { await ctx.configEditor.edit(upload, current => ({ ...current, enabled: false })); }
        catch (error) {
          if (first) { stored = { ...stored, uploadPrevious: null }; await domain.global.set(stored); }
          throw error;
        }
      } else if (stored.uploadPrevious !== null) {
        const previous = stored.uploadPrevious;
        await ctx.configEditor.edit(upload, current => ({ ...current, enabled: previous }));
        stored = { ...stored, uploadPrevious: null };
        await domain.global.set(stored);
      }
    }
    return { available: !!telemetry, uploadAvailable: !!upload, disabledByPlugin: required, sharing: ctx.get('sessionTelemetry')?.sharing ?? null };
  }
  const snapshot = () => ({ revision, features: features(), language: value('language'), policies: Object.fromEntries(policies.entries()), telemetry: { available: !!telemetryEntry(), sharing: ctx.get('sessionTelemetry')?.sharing ?? null, disabledByPlugin: domain.global.get().telemetryPrevious !== null, uploadLocked: domain.global.get().uploadPrevious !== null } });
  async function setPolicy(sessionId, args) {
    const previous = policies.get(sessionId) || EMPTY_POLICY;
    const updated = changePolicy(previous, args, features());
    await policies.put(sessionId, updated);
    revision++;
    if (args.feature === 'privacy') {
      try { await syncTelemetry(); }
      catch (error) { await policies.put(sessionId, previous); revision++; throw error; }
    }
    return { sessionId, policy: policy(sessionId), revision };
  }
  async function submitFeedback(args) {
    if (typeof args.sessionId !== 'string' || typeof args.messageId !== 'string' || !['positive', 'negative'].includes(args.rating)) throw new Error('Invalid feedback target');
    const p = policy(args.sessionId);
    if (p[args.rating]) throw new Error('This rating is disabled');
    const note = String(args.note || '').trim();
    if (Buffer.byteLength(note) > 8192) throw new Error('Feedback exceeds 8192 bytes');
    return recordFeedback({ ...args, note });
  }
  async function recordFeedback(item) {
    const service = ctx.get('messageFeedback');
    if (!service) throw new Error('The DSH feedback service is unavailable');
    const listed = await service.list({ sessionId: item.sessionId });
    if (!listed.ok) throw new Error(JSON.stringify(listed.error));
    const current = listed.value.items.find(row => row.messageId === item.messageId);
    const result = await service.put({ sessionId: item.sessionId, messageId: item.messageId, rating: item.rating, ...(item.note ? { note: item.note } : {}), ifVersion: current?.version ?? null });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    return { status: 'recorded', delivery: 'local-record-only; official receipt unavailable', item: result.value };
  }
  function tool(name, description, properties, required, execute) {
    ctx.tools.register({ name, description, parameters: { type: 'object', properties, required, additionalProperties: false },
      output: { schema: { type: 'object', additionalProperties: true }, render: (_args, result) => [{ type: 'text', text: JSON.stringify(result) }] },
      async execute(args, exec) { if (!exec.agent) throw new Error('A session is required'); return serial(() => execute(exec.agent.id, args)); },
    });
  }
  tool('conversation_lock_status', 'Read this session’s user-authorized conversation restrictions.', {}, [], async id => {
    const agent = ctx.agents.get(id);
    const command = agent ? ctx.commands.find(agent, 'feedback') : undefined;
    const configEntries = ctx.configEditor.entries().map(row => entryIdentities(row).join('|') || '<no identity>').slice(0, 60);
    const upload = uploadEntry();
    return { sessionId: id, hostBuild: HOST_BUILD, feedbackCommand: command ? command.description : null, configEntries, uploadEnabled: upload ? currentUploadEnabled(upload) : null, uploadLocked: domain.global.get().uploadPrevious !== null, features: features(), policy: policy(id) };
  });
  tool('conversation_lock_set', 'Set or release a local restriction for the current session. enabled=true applies the restriction; false releases it. User settings determine available features. Conversation closure is a local plugin action, not an official moderation decision. Privacy disables official API Session Log for this session and Session telemetry globally while any session requests it.', {
    feature: { type: 'string', enum: FEATURES }, enabled: { type: 'boolean' }, target: { type: 'string', enum: ['positive', 'negative', 'both'], description: 'Required for feedback; selects which rating buttons to restrict.' }, until: { type: ['string', 'null'], description: 'Conversation closure expiry in ISO 8601 with timezone, e.g. 2026-12-01T10:30:00+08:00. Omit/null for permanent closure.' }, reason: { type: 'string', description: 'Reason shown with the local closure notice.' },
  }, ['feature', 'enabled'], setPolicy);
  // `/feedback` is the third feedback entry: it shares the disabled-feedback
  // policy, so both ratings being disabled blocks it too. The description is
  // the host's own text, which keeps the slash-menu row unchanged.
  async function submitSessionFeedback(sessionId, rawInput) {
    const p = policy(sessionId);
    if (p.positive && p.negative) return { kind: 'error', text: 'Feedback is disabled for this conversation.' };
    const note = String(rawInput || '').trim();
    if (!note) return { kind: 'error', text: 'Usage: /feedback <text>' };
    if (Buffer.byteLength(note) > 8192) return { kind: 'error', text: 'Feedback exceeds 8192 bytes' };
    const service = ctx.get('sessionFeedback');
    if (!service) return { kind: 'error', text: 'The DSH session feedback service is unavailable.' };
    try {
      const result = await service.record({ sessionId, text: note });
      if (!result.ok) return { kind: 'error', text: JSON.stringify(result.error) };
      return { kind: 'success', text: 'Feedback recorded in DSH; no official receipt is available.' };
    } catch (error) { return { kind: 'error', text: String(error?.message ?? error) }; }
  }
  const commandDisposers = new Map();
  function registerFeedbackCommand(agent) {
    if (commandDisposers.has(agent.id)) return;
    const dispose = agent.ctx.inject(['commands'], scope => scope.commands.register({
      name: 'feedback',
      description: 'Record feedback about this session',
      input: { hint: '<text>' },
      recordInput: false,
      handler: invocation => submitSessionFeedback(invocation.agent.id, invocation.rawInput),
    }));
    commandDisposers.set(agent.id, dispose);
    ctx.effect(() => () => {
      const owned = commandDisposers.get(agent.id);
      commandDisposers.delete(agent.id);
      if (typeof owned === 'function') owned();
    });
  }
  for (const agent of ctx.agents.list()) registerFeedbackCommand(agent);
  ctx.on('agent/created', ({ agent }) => registerFeedbackCommand(agent));
  ctx.inject(['sessionLogDeepSeek'], scope => { scope.sessionLogDeepSeek.registerExclusion(request => policy(request.sessionId).privacy); });
  // Requests from another frontend cannot enter a new model step while closed.
  ctx.on('agent/pre-step', (payload, next) => policy(payload.agent.id).closed ? { kind: 'reject' } : next());
  ctx.on('settings/document-updated', () => { revision++; });
  const handle = async (method, args, _signal, peer) => {
    if (peer.principal.kind !== 'owner') return { ok: false, error: { code: 'forbidden', message: 'Owner access required', details: {} } };
    try {
      const result = await serial(async () => {
        if (method === 'state') return snapshot();
        if (method === 'settings') {
          const patch = {};
          for (const key of FEATURES) if (typeof args?.[key] === 'boolean') patch[key] = args[key];
          if (args?.language !== undefined) { if (!['auto', 'zh', 'en'].includes(args.language)) throw new Error('Invalid language'); patch.language = args.language; }
          await ctx.configEditor.edit(ctx.fiber.entry, current => ({ ...current, ...patch }));
          await syncTelemetry(); revision++; return snapshot();
        }
        if (method === 'release') {
          if (typeof args?.sessionId !== 'string') throw new Error('Invalid session');
          await policies.put(args.sessionId, { ...EMPTY_POLICY }); await syncTelemetry(); revision++; return snapshot();
        }
        if (method === 'feedback') return submitFeedback(args);
        if (method === 'upload-preference') {
          if ([...policies.entries()].some(([id]) => policy(id).privacy)) throw new Error('Upload preference is locked by a session privacy restriction');
          if (typeof args?.enabled !== 'boolean') throw new Error('Upload setting unavailable: enabled must be a boolean');
          const entry = findConfigEntry('@deepseek-ai/dsh-session-log-deepseek', 'session-log-deepseek');
          if (!entry) {
            const seen = ctx.configEditor.entries().map(row => entryIdentities(row).join('|') || '<no identity>').slice(0, 40).join(', ');
            throw new Error(`Upload setting unavailable: no Loader row matches dsh-session-log-deepseek. Rows: ${seen}`);
          }
          await ctx.configEditor.edit(entry, current => ({ ...current, enabled: args.enabled })); return { saved: true };
        }
        throw new Error('Unknown operation');
      });
      return { ok: true, value: result };
    } catch (error) { return { ok: false, error: { code: 'conversation-lock/rejected', message: String(error.message || error), details: {} } }; }
  };
  // Exact Fetch routes use Connection's authenticated owner-only admission. Avoid the
  // generic RPC channel's webServer dependency on the service-owned context.
  for (const method of ['state', 'settings', 'release', 'feedback', 'upload-preference']) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: `/api/conversation-lock/${method}`, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        try {
          const body = await request.json();
          const result = await handle(method, body?.payload, request.signal, { principal: { kind: 'owner' } });
          return Response.json({ type: 'server-response', rpcId: body?.rpcId, result });
        } catch (error) { return Response.json({ result: { ok: false, error: { message: String(error.message || error) } } }, { status: 400 }); }
      },
    }));
  }
  await syncTelemetry();
}
