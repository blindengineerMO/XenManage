async function bootstrapSession(routerInstance = router) {
  const bootstrap = window.__XENMANGE_BOOTSTRAP__;
  store.bootMessage = 'Verifying session state';

  if (bootstrap && typeof bootstrap === 'object') {
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

  if (!store.authenticated && routerInstance.currentRoute.value.path !== '/login') {
    routerInstance.replace('/login');
  }
}
