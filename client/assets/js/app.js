/**
 * XenMange client — application bootstrap.
 *
 * Concatenated last in scripts/build-client.js. Not an ES module: Vue APIs,
 * AppShell, router, and bootstrapSession are already in the shared global scope.
 *
 * Purpose: create the Vue 3 app, install the router, mount #app, then restore
 * session state from the server-injected bootstrap payload.
 * Consumers: the built dist/app.js entry; nothing else calls this file.
 * Gotchas: must run after foundation.js, routes.js, router.js, and
 * bootstrap-session.js. Do not add `import`/`export` here — the concatenator
 * would treat them as syntax in a non-module bundle.
 */
const app = createApp(AppShell);

app.use(router);
app.mount('#app');
bootstrapSession(router);
