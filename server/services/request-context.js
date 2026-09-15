// AsyncLocalStorage bag for the current HTTP request. middleware/request-context.js
// calls run(); audit-log.record() reads breakGlassElevated from get() when the
// caller omits it. get() returns {} outside a run() — never assume keys exist.
// Keep the stored object small (requestId, operator, break-glass). Not a session
// substitute and not safe to mutate after the request has finished.
const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

function run(context, fn) {
  return storage.run(context, fn);
}

/** Current request bag, or {} if called outside middleware/request-context run(). */
function get() {
  return storage.getStore() || {};
}

module.exports = { run, get };
