export const FEATURES = ['conversation', 'feedback', 'stop', 'privacy', 'copy'];
// `review` is part of the stored shape only: sessions saved by 1.0.x still carry
// that key, and the storage schema must keep validating them.
export const EMPTY_POLICY = Object.freeze({ closed: false, until: null, reason: '', positive: false, negative: false, stop: false, review: false, privacy: false, copy: false });
export function effective(policy = {}, features = {}, now = Date.now()) {
  const p = { ...EMPTY_POLICY, ...policy };
  return { ...p, closed: !!features.conversation && p.closed && (p.until === null || p.until > now), positive: !!features.feedback && p.positive, negative: !!features.feedback && p.negative, stop: !!features.stop && p.stop, privacy: !!features.privacy && p.privacy, copy: !!features.copy && p.copy };
}
export function changePolicy(previous, args, features, now = Date.now()) {
  if (!args || typeof args !== 'object') throw new Error('Invalid policy request');
  const p = { ...EMPTY_POLICY, ...previous };
  const key = args.feature;
  if (!FEATURES.includes(key)) throw new Error('Unknown feature');
  if (!features[key]) throw new Error('This feature is disabled by the user');
  if (typeof args.enabled !== 'boolean') throw new Error('enabled must be boolean');
  if (key === 'conversation') {
    let until = null;
    if (args.enabled && args.until !== undefined && args.until !== null) {
      // Explicit timezone prevents interpreting a local timestamp in the Host timezone.
      if (typeof args.until !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(args.until)) throw new Error('until needs an ISO timestamp with timezone');
      until = Date.parse(args.until);
      if (!Number.isFinite(until) || until <= now) throw new Error('until must be in the future');
    }
    p.closed = args.enabled; p.until = until; p.reason = String(args.reason || '').slice(0, 1000);
  } else if (key === 'feedback') {
    if (!['positive', 'negative', 'both'].includes(args.target)) throw new Error('target must be positive, negative or both');
    if (args.target !== 'negative') p.positive = args.enabled;
    if (args.target !== 'positive') p.negative = args.enabled;
  } else p[key] = args.enabled;
  return p;
}
export function countdown(until, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  return { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}
