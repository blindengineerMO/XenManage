const app = createApp(AppShell);

app.use(router);
app.mount('#app');
bootstrapSession(router);
