const LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'debug' : 'debug');

function should(level) {
  const order = ['debug', 'info', 'warn', 'error'];
  return order.indexOf(level) >= order.indexOf(LEVEL);
}

function nowTags() {
  const d = new Date();
  const iso = d.toISOString();
  const human = d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: 'numeric', minute: '2-digit'
  });
  return { iso, human };
}

function fmt(scope, msg, extra) {
  const { iso, human } = nowTags();
  const base = `[${iso} | ${human}]${scope ? ` ${scope}` : ''}`;
  if (extra === undefined) return `${base} ${msg}`;
  return `${base} ${msg}`;
}

function safePayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return String(payload);
  }
}

function logWith(consoleFn, level, scope, msg, payload) {
  if (!should(level)) return;
  const line = fmt(scope, msg);
  if (payload !== undefined) consoleFn(line, safePayload(payload));
  else consoleFn(line);
}

function errorDetails(scope, err, context) {
  const { iso, human } = nowTags();
  const code = err?.code || err?.status || err?.name || 'ERR';
  const hint = err?.hint || err?.response?.data?.hint || err?.details || undefined;
  const message = err?.message || err?.response?.data?.message || String(err);
  const supaMsg = err?.response?.data || undefined;
  const payload = context ? safePayload(context) : undefined;
  console.error(`[${iso} | ${human}] ${scope} ERROR`, { code, hint, message, supabase: supaMsg, payload });
}

export default {
  debug: (scope, msg, payload) => logWith(console.log, 'debug', scope, msg, payload),
  info: (scope, msg, payload) => logWith(console.log, 'info', scope, msg, payload),
  warn: (scope, msg, payload) => logWith(console.warn, 'warn', scope, msg, payload),
  error: (scope, err, context) => errorDetails(scope, err, context),
  stamp: () => nowTags(),
};
