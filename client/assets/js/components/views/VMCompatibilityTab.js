const VMCompatibilityTab = {
  components: {
    DataTable,
    StatusBadge,
  },
  props: ['model'],
  template: `
    <div>
      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Placement Compatibility</div>
          <p class="text-muted" style="margin-bottom:12px">
            Current XAPI guidance favors preflight host compatibility checks over direct CPU masking. XenMange evaluates candidate hosts and highlights where the workload can boot or migrate safely.
          </p>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Eligible Hosts</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.hosts.length ? `${model.compatibleHostCount} compatible of ${model.hosts.length} evaluated host${model.hosts.length === 1 ? '' : 's'}` : 'No host compatibility data was returned for this workload.' }}
                </div>
              </div>
              <span class="badge" :class="model.compatibleHostCount ? 'badge-running' : 'badge-warning'">
                {{ model.compatibleHostCount ? 'ready' : 'review' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Hardware Platform Version</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.hardwarePlatformVersion ? `Virtual hardware platform ${model.hardwarePlatformVersion}` : 'No explicit virtual hardware platform requirement was reported.' }}
                </div>
              </div>
              <span class="badge badge-info">vm</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>CPU Feature Baseline</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.flagCount ? `${model.flagCount} last-boot CPU feature flag${model.flagCount === 1 ? '' : 's'} captured for operator review` : 'The current XAPI record did not expose last-boot CPU flags for this workload.' }}
                </div>
              </div>
              <span class="badge badge-info">baseline</span>
            </div>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Compatibility Guidance</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Current Host Family</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.currentHostCpuModel || 'No active resident host CPU model was found for this VM.' }}
                </div>
              </div>
              <span class="badge badge-info">cpu</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>XAPI Coverage Note</strong>
                <div class="text-muted mono" style="font-size:11px">
                  Host CPU feature mutation calls are removed in the current official XAPI reference, so XenMange surfaces compatibility evidence and migration prechecks instead of exposing stale masking toggles.
                </div>
              </div>
              <span class="badge badge-warning">docs</span>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Host Compatibility Matrix</div>
        <data-table :columns="model.columns" :data="model.hosts" :loading="false" :searchable="true">
          <template #cell-name_label="{ row }">
            <span style="color:var(--text-primary);font-weight:500">{{ row.name_label }}</span>
          </template>
          <template #cell-readiness="{ row }">
            <status-badge :status="row.readiness"></status-badge>
          </template>
          <template #cell-compatible="{ row }">
            <span class="badge" :class="row.compatible ? 'badge-running' : 'badge-warning'">
              {{ row.compatible ? 'compatible' : 'blocked' }}
            </span>
          </template>
          <template #cell-cpuModel="{ row }">
            <span class="mono">{{ row.cpuModel || '-' }}</span>
          </template>
          <template #cell-compatibilityError="{ row }">
            <span class="mono property-wrap">{{ row.compatibilityError || (row.compatible ? 'Placement checks passed.' : '-') }}</span>
          </template>
        </data-table>
      </div>

      <div class="detail-section" v-if="model.flagRows.length">
        <div class="detail-section-title">Last Boot CPU Flags</div>
        <div class="property-grid">
          <template v-for="flag in model.flagRows" :key="flag.key">
            <span class="text-muted mono">{{ flag.key }}</span>
            <span class="mono">{{ flag.value }}</span>
          </template>
        </div>
      </div>
    </div>
  `,
};
