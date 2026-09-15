/**
 * XenMange client — session restore after mount.
 *
 * Concatenated just before app.js (scripts/build-client.js). Not an ES module.
 *
 * Purpose: seed CSRF + `store` from `window.__XENMANGE_BOOTSTRAP__` (or
 * GET /api/auth/status), then redirect to login or the authenticated home.
 * Consumers: app.js only (`bootstrapSession(router)` after `app.mount`).
 * Gotchas: waits for `router.isReady()` so the public catalog is not
 * bounced to /login. Sets `store.ready = true` only after status is applied.
 */

/**
 * Restore auth/target state, then align the current route with it.
 * @param {import('vue-router').Router} [routerInstance]
 */
async function bootstrapSession(routerInstance = router) {
  const bootstrap = window.__XENMANGE_BOOTSTRAP__;
  store.bootMessage = 'Verifying session state';
  // Vue Router starts at a placeholder route; resolve the browser URL before
  // deciding whether an anonymous visitor may remain on the public catalog.
  await routerInstance.isReady();

  if (bootstrap && typeof bootstrap === 'object') {
    seedCsrfToken(bootstrap.csrfToken);
    applySessionStatus({
      ...bootstrap,
      demoMode: false,
    });
    store.bootMessage = store.authenticated ? 'Restoring control surface' : 'Preparing connection console';
  } else {
    try {
      const status = await api.status();
      applySessionStatus(status);
      store.bootMessage = status.authenticated ? 'Restoring control surface' : 'Preparing connection console';
    } catch (error) {
      resetSessionState();
      store.bootMessage = 'Preparing connection console';
    }
  }

  store.ready = true;

  if (store.authenticated && routerInstance.currentRoute.value.path === '/login') {
    routerInstance.replace(resolveAuthenticatedHomePath());
  }

  if (!store.authenticated && routerInstance.currentRoute.value.path !== '/login'
    && !isPublicAppRoute(routerInstance.currentRoute.value.path)) {
    routerInstance.replace('/login');
  }
}
