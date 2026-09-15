/**
 * XenMange client — Vue Router route table.
 *
 * Concatenated after views (scripts/build-client.js). Not an ES module:
 * each `*View` component is already a global from its view file.
 *
 * Purpose: map URL paths to workspace views. Catalog path is configurable via
 * `window.__XENMANGE_BOOTSTRAP__.catalog.slug` (default `/catalog`).
 * Consumers: router.js (`appRoutes`), bootstrap-session.js / router guards
 * (`isPublicAppRoute`).
 * Gotchas: the catalog is the only public (unauthenticated) app route.
 * Adding a view requires both a concatenated view file and an entry here.
 */
const catalogSlug = String(window.__XENMANGE_BOOTSTRAP__?.catalog?.slug || 'catalog').trim() || 'catalog';
const catalogPath = `/${catalogSlug}`;

/** True when `path` is the public self-service catalog (no login required). */
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
  { path: '/projects', component: ProjectsView },
  { path: '/governance', component: GovernanceView },
  { path: '/settings', component: SettingsView },
  { path: '/lifecycle', component: LifecycleView },
  { path: '/capacity', component: CapacityView },
  { path: '/resilience', component: ResilienceView },
  { path: '/alerts', component: AlertsView },
  { path: '/activity', component: ActivityView },
];
