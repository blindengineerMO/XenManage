const catalogSlug = String(window.__XENMANGE_BOOTSTRAP__?.catalog?.slug || 'catalog').trim() || 'catalog';
const catalogPath = `/${catalogSlug}`;
function isPublicAppRoute(path) {
  return String(path || '/').replace(/\/+$/, '') === catalogPath;
}

const appRoutes = [
  { path: '/login', component: LoginView },
  { path: '/', component: DashboardView },
  { path: '/pools', component: PoolsView },
  { path: '/templates', component: TemplatesView },
  { path: '/template-library', component: TemplateLibraryView },
  { path: catalogPath, component: CatalogView },
  { path: '/applications', component: ApplicationsView },
  { path: '/vms', component: VMsView },
  { path: '/hosts', component: HostsView },
  { path: '/storage', component: StorageView },
  { path: '/networking', component: NetworkingView },
  { path: '/inventory', component: InventoryView },
  { path: '/vfabrics', component: VFabricsView },
  { path: '/governance', component: GovernanceView },
  { path: '/settings', component: SettingsView },
  { path: '/lifecycle', component: LifecycleView },
  { path: '/capacity', component: CapacityView },
  { path: '/resilience', component: ResilienceView },
  { path: '/alerts', component: AlertsView },
  { path: '/activity', component: ActivityView },
];
