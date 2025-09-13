const LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'debug');

function should(level) {
  const order = ['debug', 'info', 'warn', 'error'];
  return order.indexOf(level) >= order.indexOf(LEVEL);
}

export default {
  debug: (...args) => { if (should('debug')) console.log(...args); },
  info: (...args) => { if (should('info')) console.log(...args); },
  warn: (...args) => { if (should('warn')) console.warn(...args); },
  error: (...args) => { console.error(...args); },
};

