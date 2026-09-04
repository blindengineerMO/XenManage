const fs = require('fs');
const path = require('path');
const { compile } = require('@vue/compiler-dom');
const esbuild = require('esbuild');

const rootDir = path.join(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const distDir = path.join(clientDir, 'dist');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function stripSourceMapComments(content) {
  return content
    .replace(/\n\/\/# sourceMappingURL=.*$/gm, '')
    .replace(/\n\/\*# sourceMappingURL=.*?\*\/\s*$/gm, '');
}

function copyFile(source, destination, transform) {
  ensureDir(path.dirname(destination));
  const content = fs.readFileSync(source, 'utf8');
  fs.writeFileSync(destination, transform ? transform(content) : content);
}

function copyBinary(source, destination) {
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function copyDir(sourceDir, destinationDir) {
  ensureDir(destinationDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
    } else {
      copyBinary(sourcePath, destinationPath);
    }
  }
}

function compileTemplates(source) {
  const templatePattern = /(^[ \t]*)template:\s*`([\s\S]*?)`,/gm;

  return source.replace(templatePattern, (match, indent, template) => {
    const compiled = compile(template, {
      mode: 'function',
      prefixIdentifiers: true,
      hoistStatic: false,
      cacheHandlers: false,
    }).code;

    const indentedCode = compiled
      .trim()
      .split('\n')
      .map((line) => `${indent}  ${line}`)
      .join('\n');

    return `${indent}render: (() => {\n${indentedCode}\n${indent}})(),`;
  });
}

function buildAppBundle() {
  const sourceFiles = [
    'assets/js/core/foundation.js',
    'assets/js/core/demo-data.js',
    'assets/js/core/demo-runtime.js',
    'assets/js/core/demo-settings-routes.js',
    'assets/js/core/demo-catalog-routes.js',
    'assets/js/core/demo-profile-routes.js',
    'assets/js/core/demo-shell-routes.js',
    'assets/js/core/demo-alerts.js',
    'assets/js/core/demo-metrics.js',
    'assets/js/core/demo-remediation.js',
    'assets/js/core/demo-governance.js',
    'assets/js/core/demo-governance-routes.js',
    'assets/js/core/demo-alert-routes.js',
    'assets/js/core/demo-planning-routes.js',
    'assets/js/core/demo-infra-routes.js',
    'assets/js/core/demo-resource-routes.js',
    'assets/js/core/demo-target-routes.js',
    'assets/js/core/demo-vfabric-routes.js',
    'assets/js/core/demo-template-routes.js',
    'assets/js/core/demo-template-library-routes.js',
    'assets/js/core/demo-vm-mutation-routes.js',
    'assets/js/core/demo-vm-state-routes.js',
    'assets/js/core/demo-vm-transfer-routes.js',
    'assets/js/core/demo-summary.js',
    'assets/js/core/demo-request.js',
    'assets/js/core/api.js',
    'assets/js/core/state.js',
    'assets/js/core/shared-ui-helpers.js',
    'assets/js/core/capacity-analytics.js',
    'assets/js/core/host-view-helpers.js',
    'assets/js/core/host-view-models.js',
    'assets/js/core/host-view-service.js',
    'assets/js/core/host-view-workspace.js',
    'assets/js/core/host-view-focus.js',
    'assets/js/core/vm-view-helpers.js',
    'assets/js/core/vm-view-service.js',
    'assets/js/core/vm-view-actions.js',
    'assets/js/core/vm-view-workspace.js',
    'assets/js/core/vm-view-focus.js',
    'assets/js/core/vm-view-models.js',
    'assets/js/core/pool-view-models.js',
    'assets/js/core/capacity-view-models.js',
    'assets/js/core/storage-view-models.js',
    'assets/js/core/storage-view-workspace.js',
    'assets/js/core/storage-view-service.js',
    'assets/js/core/storage-view-focus.js',
    'assets/js/core/lifecycle-view-models.js',
    'assets/js/core/lifecycle-view-helpers.js',
    'assets/js/core/lifecycle-view-workspace.js',
    'assets/js/core/lifecycle-view-service.js',
    'assets/js/core/lifecycle-view-focus.js',
    'assets/js/core/alert-view-models.js',
    'assets/js/core/activity-view-models.js',
    'assets/js/core/resilience-view-models.js',
    'assets/js/core/governance-view-models.js',
    'assets/js/core/settings-view-models.js',
    'assets/js/core/networking-view-models.js',
    'assets/js/core/template-view-models.js',
    'assets/js/core/inventory-view-models.js',
    'assets/js/components/common/StatusBadge.js',
    'assets/js/components/common/MetricTrendCard.js',
    'assets/js/components/common/UndoBar.js',
    'assets/js/components/controls/ContextMenu.js',
    'assets/js/components/controls/DataTable.js',
    'assets/js/components/controls/TemplateLibraryTreeNode.js',
    'assets/js/components/dialogs/FloatingWindow.js',
    'assets/js/components/dialogs/PromptWindow.js',
    'assets/js/components/dialogs/ConfirmWindow.js',
    'assets/js/components/layout/SideNav.js',
    'assets/js/components/layout/StatusBar.js',
    'assets/js/components/views/VMOverviewTab.js',
    'assets/js/components/views/VMResourcesTab.js',
    'assets/js/components/views/VMCompatibilityTab.js',
    'assets/js/components/views/VMConsoleTab.js',
    'assets/js/components/forms/PoolRegistrationForm.js',
    'assets/js/components/forms/PoolConfigForm.js',
    'assets/js/components/forms/PoolHaForm.js',
    'assets/js/components/forms/HostRegistrationForm.js',
    'assets/js/components/dialogs/AddTargetWindow.js',
    'assets/js/components/dialogs/ProfileWindow.js',
    'assets/js/components/layout/TopNav.js',
    'assets/js/components/layout/AppShell.js',
    'assets/js/components/forms/HostConfigForm.js',
    'assets/js/components/forms/HostGuestVcpusParamsForm.js',
    'assets/js/components/forms/HostSchedGranForm.js',
    'assets/js/components/forms/HostLoggingForm.js',
    'assets/js/components/forms/HostMaintenanceForm.js',
    'assets/js/components/forms/AlertStateForm.js',
    'assets/js/components/forms/AlertPolicyForm.js',
    'assets/js/components/forms/NetworkCreateForm.js',
    'assets/js/components/forms/NetworkConfigForm.js',
    'assets/js/components/forms/NetworkVlanCreateForm.js',
    'assets/js/components/forms/NetworkBondCreateForm.js',
    'assets/js/components/forms/NetworkVifAttachForm.js',
    'assets/js/components/forms/NetworkVifQosForm.js',
    'assets/js/components/forms/RemediationTaskForm.js',
    'assets/js/components/forms/RemediationTaskTemplateForm.js',
    'assets/js/components/forms/RemediationTaskUpdateForm.js',
    'assets/js/components/forms/VMConfigForm.js',
    'assets/js/components/forms/VMCreateForm.js',
    'assets/js/components/forms/TemplateCreateForm.js',
    'assets/js/components/forms/VMDeviceForm.js',
    'assets/js/components/forms/StorageSrCreateForm.js',
    'assets/js/components/forms/StorageSrConfigForm.js',
    'assets/js/components/forms/StorageVdiForm.js',
    'assets/js/components/forms/StorageVdiResizeForm.js',
    'assets/js/components/forms/VMImportForm.js',
    'assets/js/components/forms/VMMigrationForm.js',
    'assets/js/components/forms/VMSnapshotForm.js',
    'assets/js/components/forms/VMDuplicateForm.js',
    'assets/js/components/forms/GovernancePolicyForm.js',
    'assets/js/components/forms/GovernanceQuotaForm.js',
    'assets/js/components/forms/GovernanceApprovalForm.js',
    'assets/js/components/forms/LocalUserForm.js',
    'assets/js/components/forms/LocalGroupForm.js',
    'assets/js/components/forms/ApiTokenForm.js',
    'assets/js/components/forms/LifecyclePlanForm.js',
    'assets/js/components/forms/ResilienceRunbookForm.js',
    'assets/js/components/forms/ResilienceDrillForm.js',
    'assets/js/components/forms/TemplateDeployForm.js',
    'assets/js/components/forms/TemplateGovernanceForm.js',
    'assets/js/components/forms/TemplatePromotionForm.js',
    'assets/js/components/forms/TemplateDeploymentValidationForm.js',
    'assets/js/components/forms/SystemConfigSectionForm.js',
    'assets/js/components/forms/UserPasswordForm.js',
    'assets/js/components/forms/CredentialVaultForm.js',
    'assets/js/components/forms/RetentionPolicyForm.js',
    'assets/js/components/views/VMAddDevicesTab.js',
    'assets/js/components/views/VMConfigTab.js',
    'assets/js/components/views/VMDuplicateTab.js',
    'assets/js/components/views/VMMigrationTab.js',
    'assets/js/components/views/VMPortabilityTab.js',
    'assets/js/components/views/VMProtectionTab.js',
    'assets/js/components/dialogs/HostPropertiesWindow.js',
    'assets/js/components/dialogs/HostTargetConnectDialog.js',
    'assets/js/components/dialogs/HostTargetsWindow.js',
    'assets/js/components/dialogs/HostWorkspaceDialogs.js',
    'assets/js/components/dialogs/CapacityWorkspaceDialogs.js',
    'assets/js/components/dialogs/ActivityWorkspaceDialogs.js',
    'assets/js/components/dialogs/AlertsWorkspaceDialogs.js',
    'assets/js/components/dialogs/GovernanceWorkspaceDialogs.js',
    'assets/js/components/dialogs/GovernanceControlPanel.js',
    'assets/js/components/dialogs/InventoryConnectionAtlasWindow.js',
    'assets/js/components/dialogs/InventorySavedWorkspacesWindow.js',
    'assets/js/components/dialogs/LifecycleWorkspaceDialogs.js',
    'assets/js/components/dialogs/NetworkCreateDialogs.js',
    'assets/js/components/dialogs/NetworkPropertiesWindow.js',
    'assets/js/components/dialogs/NetworkWorkspaceDialogs.js',
    'assets/js/components/dialogs/PoolPropertiesWindow.js',
    'assets/js/components/dialogs/PoolTargetConnectDialog.js',
    'assets/js/components/dialogs/PoolTargetsDialogs.js',
    'assets/js/components/dialogs/PoolWorkspaceDialogs.js',
    'assets/js/components/dialogs/StoragePropertiesWindow.js',
    'assets/js/components/dialogs/StorageCreateSrWindow.js',
    'assets/js/components/dialogs/StorageWorkspaceDialogs.js',
    'assets/js/components/dialogs/StorageBrowserWindow.js',
    'assets/js/components/dialogs/SettingsWorkspaceDialogs.js',
    'assets/js/components/dialogs/TemplateWorkspaceDialogs.js',
    'assets/js/components/dialogs/VMImportWindow.js',
    'assets/js/components/dialogs/VMPropertiesWindow.js',
    'assets/js/components/dialogs/ResilienceWorkspaceDialogs.js',
    'assets/js/views/LoginView.js',
    'assets/js/views/DashboardView.js',
    'assets/js/views/TemplatesView.js',
    'assets/js/views/TemplateLibraryView.js',
    'assets/js/views/CatalogView.js',
    'assets/js/views/ApplicationsView.js',
    'assets/js/views/PoolsView.js',
    'assets/js/views/VMsView.js',
    'assets/js/views/HostsView.js',
    'assets/js/views/StorageView.js',
    'assets/js/views/NetworkingView.js',
    'assets/js/views/InventoryView.js',
    'assets/js/views/VFabricsView.js',
    'assets/js/views/GovernanceView.js',
    'assets/js/views/SettingsView.js',
    'assets/js/views/AlertsView.js',
    'assets/js/views/ActivityView.js',
    'assets/js/views/LifecycleView.js',
    'assets/js/views/CapacityView.js',
    'assets/js/views/ResilienceView.js',
    'assets/js/core/routes.js',
    'assets/js/core/router.js',
    'assets/js/core/bootstrap-session.js',
    'assets/js/app.js',
  ];
  const destinationPath = path.join(distDir, 'app.js');
  const source = sourceFiles
    .map((relativePath) => {
      const sourcePath = path.join(clientDir, relativePath);
      return fs.readFileSync(sourcePath, 'utf8');
    })
    .join('\n\n');
  const compiled = compileTemplates(source);

  ensureDir(distDir);
  fs.writeFileSync(destinationPath, compiled);
}

function copyVendorAssets() {
  const vendorDir = path.join(distDir, 'vendor');
  const vueDir = path.join(rootDir, 'node_modules', 'vue', 'dist');
  const vueRouterDir = path.join(rootDir, 'node_modules', 'vue-router', 'dist');
  const mdiDir = path.join(rootDir, 'node_modules', '@mdi', 'font');
  const monacoEsmDir = path.join(rootDir, 'node_modules', 'monaco-editor', 'esm', 'vs');

  copyFile(
    path.join(vueDir, 'vue.runtime.global.prod.js'),
    path.join(vendorDir, 'vue.runtime.global.prod.js'),
    stripSourceMapComments
  );

  copyFile(
    path.join(vueRouterDir, 'vue-router.global.prod.js'),
    path.join(vendorDir, 'vue-router.global.prod.js'),
    stripSourceMapComments
  );

  copyFile(
    path.join(mdiDir, 'css', 'materialdesignicons.min.css'),
    path.join(vendorDir, 'mdi', 'css', 'materialdesignicons.min.css'),
    stripSourceMapComments
  );

  copyDir(
    path.join(mdiDir, 'fonts'),
    path.join(vendorDir, 'mdi', 'fonts')
  );

  return buildMonacoBundle(monacoEsmDir, path.join(vendorDir, 'monaco'));
}

function buildMonacoBundle(monacoEsmDir, outDir) {
  ensureDir(outDir);
  return esbuild.build({
    entryPoints: {
      monaco: path.join(clientDir, 'assets', 'js', 'vendor', 'monaco-bootstrap.js'),
      'editor.worker': path.join(monacoEsmDir, 'editor', 'editor.worker.js'),
      'json.worker': path.join(monacoEsmDir, 'language', 'json', 'json.worker.js'),
    },
    bundle: true,
    format: 'esm',
    minify: true,
    outdir: outDir,
    loader: { '.ttf': 'file' },
  });
}

async function main() {
  ensureDir(distDir);
  await copyVendorAssets();
  buildAppBundle();
  console.log('Client bundle rebuilt in client/dist');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
