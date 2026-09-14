// Curated bundles of fine-grained permission grants that give admins a one-click
// way to build roles (VM Operator, Backup Operator, etc.) on top of the existing
// vm.*, host.*, network.* action-catalog namespaces without hand-picking dozens of
// individual permissions. See plan.md item 3: "users shouldn't need to manually
// configure hundreds of permissions - ship good templates."
const PERMISSION_TEMPLATES = [
  {
    key: 'vm-operator',
    label: 'VM Operator',
    description: 'Day-to-day VM lifecycle and power operations without host, network, or storage administration.',
    permissions: ['vm.read', 'vm.list', 'vm.create', 'vm.power.*', 'vm.snapshot.create', 'vm.migration.*', 'vm.update'],
  },
  {
    key: 'backup-operator',
    label: 'Backup Operator',
    description: 'Snapshot and restore access for backup workflows, without power or configuration control.',
    permissions: ['vm.read', 'vm.list', 'vm.snapshot.*', 'vm.backup.*', 'vm.restore'],
  },
  {
    key: 'storage-administrator',
    label: 'Storage Administrator',
    description: 'Manage storage repositories and virtual disks across the scoped pool or project.',
    permissions: ['storage.*', 'sr.*', 'vdi.*', 'vm.read', 'vm.list'],
  },
  {
    key: 'network-administrator',
    label: 'Network Administrator',
    description: 'Manage networks, VIFs, VLANs, and bonds without VM or storage administration.',
    permissions: ['network.*', 'vif.*', 'vlan.*', 'bond.*', 'vm.read', 'vm.list'],
  },
  {
    key: 'auditor',
    label: 'Auditor',
    description: 'Read-only visibility across every resource type, including governance and audit trails.',
    permissions: ['*.read', '*.list'],
  },
  {
    key: 'dr-operator',
    label: 'DR Operator',
    description: 'Failover, migration, and resilience operations for disaster-recovery runbooks.',
    permissions: ['vm.read', 'vm.list', 'vm.migration.*', 'vm.power.*', 'resilience.*', 'vm.snapshot.revert'],
  },
  {
    key: 'template-administrator',
    label: 'Template Administrator',
    description: 'Manage the template library and self-service catalog without production VM control.',
    permissions: ['template.*', 'template-library-folder.*', 'template-library-item.*', 'catalog_role.*'],
  },
  {
    key: 'project-administrator',
    label: 'Project Administrator',
    description: 'Full control scoped to a single project - VM, quota, and membership management.',
    permissions: ['vm.*', 'project.*', 'host.maintenance', 'governance.approve'],
  },
];

function list() {
  return PERMISSION_TEMPLATES.map((template) => ({ ...template, permissions: [...template.permissions] }));
}

function get(key) {
  return PERMISSION_TEMPLATES.find((template) => template.key === key) || null;
}

module.exports = { list, get };
