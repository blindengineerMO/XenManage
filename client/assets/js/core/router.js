/**
 * XenMange client — Vue Router instance and auth guards.
 *
 * Concatenated after routes.js (scripts/build-client.js). Not an ES module:
 * uses `createRouter` / `createWebHistory` from foundation.js and `appRoutes`
 * from routes.js.
 *
 * Purpose: build the SPA router and bounce unauthenticated users to /login
 * (except the public catalog) once `store.ready` is true.
 * Consumers: app.js (`app.use(router)`), bootstrap-session.js, views via
 * `useRouter()` / `useRoute()`.
 * Gotchas: guards no-op until `store.ready` so the bootstrap payload can
 * settle before a login redirect. Home is `/` when a live target is connected,
 * otherwise `/pools`.
 */

/** @returns {'/' | '/pools'} landing path for an authenticated operator */
function resolveAuthenticatedHomePath() {
  return store.connected ? '/' : '/pools';
}

/** Login wall: skip until `store.ready`; allow the public catalog without auth. */
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
