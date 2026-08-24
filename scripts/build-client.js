const fs = require('fs');
const path = require('path');
const { compile } = require('@vue/compiler-dom');

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
    'assets/js/core/state.js',
    'assets/js/components/common/StatusBadge.js',
    'assets/js/components/common/MetricTrendCard.js',
    'assets/js/components/controls/DataTable.js',
    'assets/js/components/dialogs/FloatingWindow.js',
    'assets/js/components/layout/TopNav.js',
    'assets/js/components/layout/SideNav.js',
    'assets/js/components/layout/StatusBar.js',
    'assets/js/components/forms/ConnectionLoginForm.js',
    'assets/js/components/forms/PoolRegistrationForm.js',
    'assets/js/components/forms/HostRegistrationForm.js',
    'assets/js/components/forms/AlertStateForm.js',
    'assets/js/components/forms/AlertPolicyForm.js',
    'assets/js/components/forms/RemediationTaskForm.js',
    'assets/js/components/forms/RemediationTaskTemplateForm.js',
    'assets/js/components/forms/RemediationTaskUpdateForm.js',
    'assets/js/components/forms/VMConfigForm.js',
    'assets/js/components/forms/VMDeviceForm.js',
    'assets/js/components/forms/GovernancePolicyForm.js',
    'assets/js/components/forms/GovernanceQuotaForm.js',
    'assets/js/components/forms/GovernanceApprovalForm.js',
    'assets/js/components/forms/LocalUserForm.js',
    'assets/js/components/forms/LocalGroupForm.js',
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
    'assets/js/views/LoginView.js',
    'assets/js/views/DashboardView.js',
    'assets/js/views/TemplatesView.js',
    'assets/js/views/PoolsView.js',
    'assets/js/views/VMsView.js',
    'assets/js/views/HostsView.js',
    'assets/js/views/StorageView.js',
    'assets/js/views/NetworkingView.js',
    'assets/js/views/InventoryView.js',
    'assets/js/views/GovernanceView.js',
    'assets/js/views/SettingsView.js',
    'assets/js/views/AlertsView.js',
    'assets/js/views/ActivityView.js',
    'assets/js/views/LifecycleView.js',
    'assets/js/views/CapacityView.js',
    'assets/js/views/ResilienceView.js',
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
}

function main() {
  ensureDir(distDir);
  copyVendorAssets();
  buildAppBundle();
  console.log('Client bundle rebuilt in client/dist');
}

main();
