// Cloud-init guest-script interpolation for template/catalog deploy. Replaces
// ${name} from the provided variables map (unknown names throw). Result is
// stuffed into xenstore key `vm-data` and capped at 64 KiB after interpolation.
// Consumed by template-deployment and catalog-deployment. Callers must already
// have verified the source starts with #cloud-config — this module does not.
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

/**
 * Interpolate ${vars} and return { 'vm-data': script }. Throws GUEST_SCRIPT_TOO_LARGE
 * above 64 KiB and GUEST_SCRIPT_VARIABLE_UNKNOWN for missing keys.
 */
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
