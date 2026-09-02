function createCatalogDeploymentError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function buildCatalogTemplateDeployment(entry, request, source) {
  if (source?.kind !== 'deployment-template') {
    throw createCatalogDeploymentError('CATALOG_SOURCE_NOT_DEPLOYABLE', 'Only deployment-template catalog sources can be dispatched.');
  }
  let artifact;
  try { artifact = JSON.parse(source.content || '{}'); } catch (_error) {
    throw createCatalogDeploymentError('CATALOG_SOURCE_INVALID', 'The catalog deployment source must contain valid JSON.');
  }
  const templateRef = String(artifact.templateRef || '').trim();
  const options = artifact.options && typeof artifact.options === 'object' && !Array.isArray(artifact.options) ? artifact.options : {};
  const fixed = entry.fixedVariables && typeof entry.fixedVariables === 'object' ? entry.fixedVariables : {};
  const parameters = JSON.parse(request.parameters_json || '{}');
  const resolved = { ...options, ...fixed, ...parameters, nameLabel: request.generated_name };
  if (!/^OpaqueRef:/.test(templateRef) || !Number.isInteger(Number(resolved.vcpus)) || Number(resolved.vcpus) < 1 || Number(resolved.memoryStaticMax) < 1073741824) {
    throw createCatalogDeploymentError('CATALOG_SOURCE_INVALID', 'The catalog source needs an OpaqueRef template plus valid vCPU and memory settings.');
  }
  return {
    templateRef,
    payload: {
      nameLabel: request.generated_name,
      nameDescription: String(resolved.nameDescription || ''),
      hostRef: resolved.hostRef || null,
      storageRef: resolved.storageRef || null,
      networkRef: resolved.networkRef || null,
      vcpus: Number(resolved.vcpus),
      memoryStaticMax: Number(resolved.memoryStaticMax),
      tags: Array.isArray(resolved.tags) ? resolved.tags : [],
      startAfter: Boolean(resolved.startAfter),
    },
  };
}

function buildCatalogComposeDeployment(entry, request, source) {
  if (source?.kind !== 'snippet') {
    throw createCatalogDeploymentError('CATALOG_SOURCE_NOT_DEPLOYABLE', 'Only compose snippets can be dispatched as compose catalog sources.');
  }
  let spec;
  try { spec = JSON.parse(source.content || '{}'); } catch (_error) {
    throw createCatalogDeploymentError('CATALOG_SOURCE_INVALID', 'The catalog compose source must contain valid JSON.');
  }
  if (!spec || typeof spec !== 'object' || !spec.vms || typeof spec.vms !== 'object') {
    throw createCatalogDeploymentError('CATALOG_SOURCE_INVALID', 'The catalog compose source must define a vms object.');
  }
  if (!JSON.stringify(spec).includes('${catalogName}')) {
    throw createCatalogDeploymentError('CATALOG_SOURCE_INVALID', 'Catalog compose sources must use the ${catalogName} variable in a VM name.');
  }
  const fixed = entry.fixedVariables && typeof entry.fixedVariables === 'object' ? entry.fixedVariables : {};
  const parameters = JSON.parse(request.parameters_json || '{}');
  return {
    ...spec,
    name: `${entry.title} ${request.generated_name}`.slice(0, 120),
    variables: { ...(spec.variables || {}), ...fixed, ...parameters, catalogName: request.generated_name },
  };
}

function interpolateGuestScript(content, variables) {
  return String(content || '').replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_match, name) => {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      throw createCatalogDeploymentError('CATALOG_GUEST_SCRIPT_VARIABLE_UNKNOWN', `Guest script references unknown variable "${name}".`);
    }
    return String(variables[name]);
  });
}

function buildCatalogGuestScriptDeployment(entry, request, source) {
  if (source?.kind !== 'guest-script' || !String(source.content || '').trimStart().startsWith('#cloud-config')) {
    throw createCatalogDeploymentError('CATALOG_SOURCE_NOT_DEPLOYABLE', 'Catalog guest scripts must be cloud-init #cloud-config sources.');
  }
  const fixed = entry.fixedVariables && typeof entry.fixedVariables === 'object' ? entry.fixedVariables : {};
  const parameters = JSON.parse(request.parameters_json || '{}');
  const templateRef = String(fixed.templateRef || '').trim();
  const payload = { ...fixed, ...parameters, nameLabel: request.generated_name };
  delete payload.templateRef;
  if (!/^OpaqueRef:/.test(templateRef) || !Number.isInteger(Number(payload.vcpus)) || Number(payload.vcpus) < 1 || Number(payload.memoryStaticMax) < 1073741824) {
    throw createCatalogDeploymentError('CATALOG_SOURCE_INVALID', 'Guest-script catalog entries need fixed template, vCPU, and memory settings.');
  }
  const script = interpolateGuestScript(source.content, { ...fixed, ...parameters, catalogName: request.generated_name });
  if (Buffer.byteLength(script, 'utf8') > 64 * 1024) {
    throw createCatalogDeploymentError('CATALOG_GUEST_SCRIPT_TOO_LARGE', 'Guest scripts cannot exceed 64 KiB after interpolation.');
  }
  return {
    templateRef,
    payload: {
      nameLabel: request.generated_name,
      nameDescription: String(payload.nameDescription || ''),
      hostRef: payload.hostRef || null,
      storageRef: payload.storageRef || null,
      networkRef: payload.networkRef || null,
      vcpus: Number(payload.vcpus),
      memoryStaticMax: Number(payload.memoryStaticMax),
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      startAfter: Boolean(payload.startAfter),
      xenstoreData: { 'vm-data': script },
    },
  };
}

module.exports = { buildCatalogTemplateDeployment, buildCatalogComposeDeployment, buildCatalogGuestScriptDeployment };
