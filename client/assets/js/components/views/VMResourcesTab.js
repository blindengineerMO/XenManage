const VMResourcesTab = {
  components: {
    DataTable,
    StatusBadge,
  },
  props: ['model'],
  template: `
    <div>
      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Runtime Placement</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>{{ model.host ? (model.host.name_label || 'Host') : 'Unplaced' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.host ? (model.host.address || model.host.uuid || model.host.ref) : 'No current host record' }}
                </div>
              </div>
              <status-badge :status="model.host && model.host.enabled ? 'enabled' : 'warning'"></status-badge>
            </div>
            <div class="stack-item">
              <div>
                <strong>{{ model.pool ? (model.pool.name_label || 'Pool') : 'No pool relationship' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.pool ? ((model.pool.uuid || model.pool.ref || '-') + ' · default SR ' + (model.pool.default_SR || '-')) : 'Pool membership was not reported for this workload.' }}
                </div>
              </div>
              <span class="badge badge-info">placement</span>
            </div>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Config Notes</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Device Inventory</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.attachedDisks.length }} disks · {{ model.attachedNetworks.length }} network paths
                </div>
              </div>
              <span class="badge badge-info">mapped</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Change Window Guidance</strong>
                <div class="text-muted mono" style="font-size:11px">
                  CPU and memory changes may require the VM to be halted depending on XenServer policy and guest tooling.
                </div>
              </div>
              <span class="badge badge-info">notice</span>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Attached Storage</div>
        <data-table :columns="model.diskColumns" :data="model.attachedDisks" :loading="false" :searchable="true">
          <template #cell-name_label="{ row }">
            <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || row.ref }}</span>
          </template>
          <template #cell-virtual_size="{ row }">
            <span class="mono">{{ formatBytes(row.virtual_size) }}</span>
          </template>
          <template #cell-storageName="{ row }">
            <span>{{ row.storageName }}</span>
          </template>
        </data-table>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Attached Networks</div>
        <data-table :columns="model.networkColumns" :data="model.attachedNetworks" :loading="false" :searchable="true">
          <template #cell-name_label="{ row }">
            <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || row.bridge || row.ref }}</span>
          </template>
          <template #cell-managed="{ row }">
            <status-badge :status="row.managed ? 'enabled' : 'disabled'"></status-badge>
          </template>
          <template #cell-vlan="{ row }">
            <span class="mono">{{ row.vlan }}</span>
          </template>
        </data-table>
      </div>
    </div>
  `,
  methods: {
    formatBytes,
  },
};
