const config = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function normalizeValue(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level, message, context = {}) {
  if (LEVELS[level] < configuredLevel || config.env === 'test') return;
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...Object.fromEntries(Object.entries(context).map(([key, value]) => [key, normalizeValue(value)])),
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

const logger = {
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};

module.exports = logger;
