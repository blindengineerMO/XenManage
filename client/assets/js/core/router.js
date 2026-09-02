function resolveAuthenticatedHomePath() {
  return store.connected ? '/' : '/pools';
}

function installAuthGuards(routerInstance) {
  routerInstance.beforeEach((to, from, next) => {
    if (!store.ready) {
      next();
      return;
    }

    if (to.path !== '/login' && !isPublicAppRoute(to.path) && !store.authenticated) {
      next('/login');
      return;
    }

    if (to.path === '/login' && store.authenticated) {
      next(resolveAuthenticatedHomePath());
      return;
    }

    next();
  });
}

function createAppRouter() {
  const routerInstance = createRouter({
    history: createWebHistory(),
    routes: appRoutes,
  });

  installAuthGuards(routerInstance);
  return routerInstance;
}

const router = createAppRouter();
