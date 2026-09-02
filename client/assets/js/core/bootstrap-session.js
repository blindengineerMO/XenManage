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
