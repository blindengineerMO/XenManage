const GUEST_SCRIPT_MAX_BYTES = 64 * 1024;

function createGuestScriptError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function interpolateGuestScript(content, variables) {
  return String(content || '').replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_match, name) => {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      throw createGuestScriptError('GUEST_SCRIPT_VARIABLE_UNKNOWN', `Guest script references unknown variable "${name}".`);
    }
    return String(variables[name]);
  });
}

function buildGuestScriptXenstoreData(content, variables) {
  const script = interpolateGuestScript(content, variables);
  if (Buffer.byteLength(script, 'utf8') > GUEST_SCRIPT_MAX_BYTES) {
    throw createGuestScriptError('GUEST_SCRIPT_TOO_LARGE', 'Guest scripts cannot exceed 64 KiB after interpolation.');
  }
  return { 'vm-data': script };
}

module.exports = {
  GUEST_SCRIPT_MAX_BYTES,
  createGuestScriptError,
  interpolateGuestScript,
  buildGuestScriptXenstoreData,
};
