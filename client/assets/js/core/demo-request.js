/**
 * XenMange client — demo request dispatcher (offline XAPI shim).
 *
 * Concatenated global script (scripts/build-client.js). Not an ES module.
 *
 * OFFLINE/DEMO ONLY: `api.request` calls this instead of `fetch` when
 * `store.demoMode` is true. Do not treat this as production XenServer/XAPI code.
 *
 * Purpose: parse method/path and hand off to handleDemo*Routes modules in a
 * fixed order. First defined result wins; unsupported paths throw
 * DEMO_ROUTE_UNSUPPORTED.
 * Consumers: api.js only.
 * Gotchas: handler order matters (profile/settings/catalog before VM routes).
 * Returning `undefined` means "not my route" — never return undefined as a
 * successful empty body.
 */

/**
 * @param {string} method HTTP verb
 * @param {string} url path or absolute URL under /api
 * @param {object} [body] JSON body for mutations
 */
function demoRequest(method, url, body) {
  const parsedUrl = new URL(url, window.location.origin);
  const path = parsedUrl.pathname;
  const search = parsedUrl.searchParams.get('search');
  const range = parsedUrl.searchParams.get('range') || '24h';
  const targetKey = parsedUrl.searchParams.get('targetKey') || store.currentTargetKey || 'demo-fabric';
  const scope = getDemoTargetScope(targetKey);

  const profileRouteResult = handleDemoProfileRoutes(method, path, body);
  if (profileRouteResult !== undefined) return profileRouteResult;

  const settingsRouteResult = handleDemoSettingsRoutes(method, path, body);
  if (settingsRouteResult !== undefined) {
    return settingsRouteResult;
  }

  const catalogRouteResult = handleDemoCatalogRoutes(method, path, body);
  if (catalogRouteResult !== undefined) {
    return catalogRouteResult;
  }

  const shellRouteResult = handleDemoShellRoutes(method, path, body, range);
  if (shellRouteResult !== undefined) {
    return shellRouteResult;
  }

  const alertRouteResult = handleDemoAlertActivityRoutes(method, path, body);
  if (alertRouteResult !== undefined) {
    return alertRouteResult;
  }

  const governanceRouteResult = handleDemoGovernanceRoutes(method, path, body);
  if (governanceRouteResult !== undefined) {
    return governanceRouteResult;
  }

  const planningRouteResult = handleDemoPlanningRoutes(method, path, body);
  if (planningRouteResult !== undefined) {
    return planningRouteResult;
  }

  const infraRouteResult = handleDemoInfraRoutes(method, path, body, scope);
  if (infraRouteResult !== undefined) {
    return infraRouteResult;
  }

  const templateRouteResult = handleDemoTemplateRoutes(method, path, body, parsedUrl, search, targetKey);
  if (templateRouteResult !== undefined) {
    return templateRouteResult;
  }

  const vmTransferRouteResult = handleDemoVmTransferRoutes(method, path, body, parsedUrl, search, targetKey);
  if (vmTransferRouteResult !== undefined) {
    return vmTransferRouteResult;
  }

  const vmStateRouteResult = handleDemoVmStateRoutes(method, path, body, parsedUrl, targetKey);
  if (vmStateRouteResult !== undefined) {
    return vmStateRouteResult;
  }

  const vmMutationRouteResult = handleDemoVmMutationRoutes(method, path, body);
  if (vmMutationRouteResult !== undefined) {
    return vmMutationRouteResult;
  }

  const resourceRouteResult = handleDemoResourceRoutes(method, path, body, scope, parsedUrl);
  if (resourceRouteResult !== undefined) {
    return resourceRouteResult;
  }

  const vFabricRouteResult = handleDemoVFabricRoutes(method, path, body);
  if (vFabricRouteResult !== undefined) {
    return vFabricRouteResult;
  }

  const targetRouteResult = handleDemoTargetRoutes(method, path, body);
  if (targetRouteResult !== undefined) {
    return targetRouteResult;
  }

  const projectsRouteResult = handleDemoProjectsRoutes(method, path, body);
  if (projectsRouteResult !== undefined) {
    return projectsRouteResult;
  }

  const templateLibraryRouteResult = handleDemoTemplateLibraryRoutes(method, path, body);
  if (templateLibraryRouteResult !== undefined) {
    return templateLibraryRouteResult;
  }

  throw new Error(`DEMO_ROUTE_UNSUPPORTED: ${method} ${path}`);
}
