const NAMING_PATTERN = /^(.*?)(X+)(.*?)$/;
const FIELD_TYPES = new Set(['string', 'number', 'boolean', 'select']);
const APPROVAL_MODES = new Set(['manual', 'auto', 'threshold', 'webhook', 'multi-step']);

function createCatalogError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

function validateNamingPattern(value) {
  const pattern = String(value || '').trim();
  const match = pattern.match(NAMING_PATTERN);
  if (!match || (pattern.match(/X+/g) || []).length !== 1) {
    throw createCatalogError('CATALOG_NAMING_PATTERN_INVALID', 'Use exactly one contiguous run of X characters, such as NODE-XXXX.');
  }
  if (pattern.length > 120) {
    throw createCatalogError('CATALOG_NAMING_PATTERN_INVALID', 'Naming patterns cannot exceed 120 characters.');
  }
  return pattern;
}

function renderGeneratedName(pattern, sequence) {
  const validated = validateNamingPattern(pattern);
  const number = Number(sequence);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw createCatalogError('CATALOG_SEQUENCE_INVALID', 'Catalog sequence must be a positive integer.');
  }
  return validated.replace(/X+/, (placeholder) => String(number).padStart(placeholder.length, '0'));
}

function normalizeSubscriberFields(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 30) {
    throw createCatalogError('CATALOG_FIELDS_INVALID', 'Subscriber fields must be an array of at most 30 fields.');
  }

  const keys = new Set();
  return value.map((field) => {
    const key = String(field?.key || '').trim();
    const type = String(field?.type || 'string').trim().toLowerCase();
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || keys.has(key) || !FIELD_TYPES.has(type)) {
      throw createCatalogError('CATALOG_FIELDS_INVALID', 'Each subscriber field needs a unique key and supported type.');
    }
    keys.add(key);
    const options = type === 'select'
      ? [...new Set((Array.isArray(field.options) ? field.options : []).map((option) => String(option).trim()).filter(Boolean))]
      : [];
    if (type === 'select' && !options.length) {
      throw createCatalogError('CATALOG_FIELDS_INVALID', 'Select fields require at least one option.');
    }
    return {
      key,
      label: String(field.label || key).trim().slice(0, 120),
      type,
      required: Boolean(field.required),
      default: field.default ?? null,
      options,
    };
  });
}

function validateRequestParameters(fields, values) {
  const supplied = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const allowed = new Set(fields.map((field) => field.key));
  if (Object.keys(supplied).some((key) => !allowed.has(key))) {
    throw createCatalogError('CATALOG_PARAMETERS_INVALID', 'One or more submitted fields are not available for this catalog entry.');
  }

  const resolved = {};
  fields.forEach((field) => {
    const value = supplied[field.key] ?? field.default;
    if ((value === null || value === undefined || value === '') && field.required) {
      throw createCatalogError('CATALOG_PARAMETERS_INVALID', `${field.label} is required.`);
    }
    if (value === null || value === undefined || value === '') return;
    if (field.type === 'string' && typeof value !== 'string') throw createCatalogError('CATALOG_PARAMETERS_INVALID');
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw createCatalogError('CATALOG_PARAMETERS_INVALID');
    if (field.type === 'boolean' && typeof value !== 'boolean') throw createCatalogError('CATALOG_PARAMETERS_INVALID');
    if (field.type === 'select' && !field.options.includes(String(value))) throw createCatalogError('CATALOG_PARAMETERS_INVALID');
    resolved[field.key] = value;
  });
  return resolved;
}

function normalizeApprovalPolicy(value, requiresApproval = true) {
  if (value === undefined || value === null) return { mode: requiresApproval ? 'manual' : 'auto' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw createCatalogError('CATALOG_APPROVAL_POLICY_INVALID');
  const mode = String(value.mode || '').trim().toLowerCase();
  if (!APPROVAL_MODES.has(mode)) throw createCatalogError('CATALOG_APPROVAL_POLICY_INVALID');
  if (mode === 'manual' || mode === 'auto') return { mode };
  if (mode === 'multi-step') {
    if (!Array.isArray(value.steps) || value.steps.length < 2 || value.steps.length > 5) {
      throw createCatalogError('CATALOG_APPROVAL_POLICY_INVALID');
    }
    const steps = value.steps.map((step) => String(step || '').trim().slice(0, 120));
    if (steps.some((step) => !step) || new Set(steps.map((step) => step.toLowerCase())).size !== steps.length) {
      throw createCatalogError('CATALOG_APPROVAL_POLICY_INVALID');
    }
    return { mode, steps };
  }
  if (mode === 'webhook') {
    const url = String(value.url || '').trim();
    const credentialId = Number(value.credentialId);
    if (!url || !Number.isInteger(credentialId) || credentialId < 1) throw createCatalogError('CATALOG_APPROVAL_POLICY_INVALID');
    return { mode, url, credentialId };
  }
  const field = String(value.field || '').trim();
  const max = Number(value.max);
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(field) || !Number.isFinite(max)) {
    throw createCatalogError('CATALOG_APPROVAL_POLICY_INVALID');
  }
  return { mode, field, max };
}

function shouldAutoApprove(policy, parameters) {
  if (policy.mode === 'auto') return true;
  return policy.mode === 'threshold' && typeof parameters?.[policy.field] === 'number' && parameters[policy.field] <= policy.max;
}

function normalizeLeaseDuration(value) {
  if (value === undefined || value === null || value === '') return null;
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < 1 || hours > 87600) {
    throw createCatalogError('CATALOG_LEASE_INVALID', 'Lease duration must be a whole number from 1 to 87600 hours.');
  }
  return hours;
}

function normalizeCostRates(value) {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw createCatalogError('CATALOG_COST_RATES_INVALID');
  const rates = {};
  for (const key of ['perVcpu', 'perGiBRam', 'perGiBDisk']) {
    if (value[key] === undefined || value[key] === null || value[key] === '') continue;
    const rate = Number(value[key]);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000000) throw createCatalogError('CATALOG_COST_RATES_INVALID');
    rates[key] = rate;
  }
  return rates;
}

function estimateCatalogCost(entry, parameters = {}) {
  const rates = normalizeCostRates(entry.costRates || {});
  if (!Object.keys(rates).length) return null;
  const values = { ...(entry.fixedVariables || {}), ...(parameters || {}) };
  const vcpus = Math.max(0, Number(values.vcpus || values.VCPUs || 0));
  const memoryGiB = Math.max(0, Number(values.memoryGiB ?? (Number(values.memoryStaticMax || 0) / (1024 ** 3))));
  const diskGiB = Math.max(0, Number(values.diskGiB ?? values.diskSizeGiB ?? values.diskSizeGb ?? values.storageGiB ?? 0));
  const monthlyCost = (vcpus * (rates.perVcpu || 0)) + (memoryGiB * (rates.perGiBRam || 0)) + (diskGiB * (rates.perGiBDisk || 0));
  if (![vcpus, memoryGiB, diskGiB, monthlyCost].every(Number.isFinite)) throw createCatalogError('CATALOG_COST_INPUT_INVALID');
  return { monthlyCost: Math.round(monthlyCost * 100) / 100, currency: 'USD', resources: { vcpus, memoryGiB, diskGiB } };
}

function normalizeTargetPoolRefs(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) throw createCatalogError('CATALOG_TARGET_POOLS_INVALID');
  const refs = [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  if (refs.length !== value.length || refs.some((entry) => entry.length > 240)) throw createCatalogError('CATALOG_TARGET_POOLS_INVALID');
  return refs;
}

module.exports = { validateNamingPattern, renderGeneratedName, normalizeSubscriberFields, validateRequestParameters, normalizeApprovalPolicy, shouldAutoApprove, normalizeLeaseDuration, normalizeCostRates, estimateCatalogCost, normalizeTargetPoolRefs };
