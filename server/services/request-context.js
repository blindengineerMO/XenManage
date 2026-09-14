const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

function run(context, fn) {
  return storage.run(context, fn);
}

function get() {
  return storage.getStore() || {};
}

module.exports = { run, get };
