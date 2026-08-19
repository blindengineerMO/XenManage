const ResilienceView = {
  components: { FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading protection posture, failover readiness, and recovery plans...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-shield-lock-outline"></span>
              Resilience
            </h2>
            <p class="section-subtitle">Protection coverage, failover posture, and recovery-planning visibility inspired by Prism and Proxmox-style operator workflows.</p>
          </div>
          <button class="btn btn-primary" @click="loadResilience">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>

        <div class="dashboard-hero resilience-hero">
          <div>
            <div class="dash-card-label">Protection Control Plane</div>
            <h3>Backup posture, evacuation readiness, and recovery drift in one operator queue.</h3>
            <p>This workspace consolidates workload protection status, host failover notes, and pool-level recovery plans so resilience work does not disappear into raw task history alone.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Recovery Events
            </button>
            <button class="btn" @click="$router.push('/hosts')">
              <span class="mdi mdi-server"></span>
              Host Plans
            </button>
            <button class="btn" @click="$router.push('/vms')">
              <span class="mdi mdi-desktop-tower"></span>
              VM Coverage
            </button>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card" v-for="card in summaryCards" :key="card.key">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
            <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Protection Policies</div>
            <div class="stack-list" v-if="protectionPolicies.length">
              <button class="stack-item stack-item-button"
                      v-for="policy in prioritizedPolicies.slice(0, 8)"
                      :key="policy.ref"
                      @click="openInspector('policy', policy)">
                <div class="capacity-item-main">
                  <strong>{{ policy.name_label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ policy.policy }} · {{ policy.power_state }} · {{ formatDateTime(policy.lastProtectedAt) }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ policy.recommendation }}</div>
                </div>
                <status-badge :status="policy.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No protection policy data available.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Host Failover Readiness</div>
            <div class="stack-list" v-if="hostPlans.length">
              <button class="stack-item stack-item-button"
                      v-for="host in prioritizedHosts.slice(0, 8)"
                      :key="host.ref"
                      @click="openInspector('host', host)">
                <div class="capacity-item-main">
                  <strong>{{ host.name_label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ host.address || host.uuid || host.ref }} · {{ host.residentVmCount }} VMs</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ host.summary }}</div>
                </div>
                <status-badge :status="host.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No host readiness records available.</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Recovery Plans</div>
            <div class="stack-list" v-if="recoveryPlans.length">
              <button class="stack-item stack-item-button"
                      v-for="plan in prioritizedRecoveryPlans"
                      :key="plan.ref"
                      @click="openInspector('plan', plan)">
                <div class="capacity-item-main">
                  <strong>{{ plan.name_label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ plan.enabledHostCount }} hosts ready · {{ plan.protectedVmCount }} protected · {{ plan.atRiskVmCount }} at risk</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ plan.nextAction }}</div>
                </div>
                <status-badge :status="plan.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No recovery plans reported.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Recent Recovery Events</div>
            <div class="stack-list" v-if="recentEvents.length">
              <div class="stack-item" v-for="event in recentEvents.slice(0, 10)" :key="event.ref">
                <div>
                  <strong>{{ event.label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ event.type }} · {{ formatDateTime(event.timestamp) }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ event.detail || 'No detail provided' }}</div>
                </div>
                <status-badge :status="event.status"></status-badge>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No recent resilience events reported.</div>
          </div>
        </div>

        <floating-window :show="showInspector"
                         :title="inspectorTitle"
                         :width="780"
                         :height="500"
                         @close="closeInspector">
          <div v-if="selectedItemType === 'policy' && selectedItem">
            <div class="property-grid">
              <span class="text-muted">Workload</span><span>{{ selectedItem.name_label }}</span>
              <span class="text-muted">Policy</span><span>{{ selectedItem.policy }}</span>
              <span class="text-muted">Status</span><status-badge :status="selectedItem.status"></status-badge>
              <span class="text-muted">Power State</span><span>{{ selectedItem.power_state }}</span>
              <span class="text-muted">Last Protected</span><span class="mono">{{ formatDateTime(selectedItem.lastProtectedAt) }}</span>
              <span class="text-muted">Recent Task</span><span class="property-wrap">{{ selectedItem.lastTaskLabel }}</span>
              <span class="text-muted">Recent Alert</span><span class="property-wrap">{{ selectedItem.lastAlertLabel }}</span>
              <span class="text-muted">Tags</span><span>{{ truncateList(selectedItem.tags) }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedItem.uuid || '-' }}</span>
            </div>
            <div class="detail-section">
              <div class="detail-section-title">Protection Guidance</div>
              <div class="capacity-callout">
                <strong>{{ selectedItem.recommendation }}</strong>
                <p>Use this record to decide whether the workload needs a fresh backup, a restore test, or deeper replication validation before change activity.</p>
              </div>
            </div>
          </div>

          <div v-if="selectedItemType === 'host' && selectedItem">
            <div class="property-grid">
              <span class="text-muted">Host</span><span>{{ selectedItem.name_label }}</span>
              <span class="text-muted">Address</span><span class="mono">{{ selectedItem.address || '-' }}</span>
              <span class="text-muted">Status</span><status-badge :status="selectedItem.status"></status-badge>
              <span class="text-muted">Evacuation Target</span><span>{{ selectedItem.evacuationTarget }}</span>
              <span class="text-muted">Resident VMs</span><span>{{ selectedItem.residentVmCount }}</span>
              <span class="text-muted">Recent Task</span><span class="property-wrap">{{ selectedItem.recentTask }}</span>
              <span class="text-muted">Recent Alert</span><span class="property-wrap">{{ selectedItem.recentAlert }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedItem.uuid || '-' }}</span>
            </div>
            <div class="detail-section">
              <div class="detail-section-title">Failover Guidance</div>
              <div class="capacity-callout">
                <strong>{{ selectedItem.summary }}</strong>
                <p>Validate target capacity, evacuation sequencing, and recovery dependencies before placing this host into maintenance or using it as a failover source.</p>
              </div>
            </div>
          </div>

          <div v-if="selectedItemType === 'plan' && selectedItem">
            <div class="property-grid">
              <span class="text-muted">Recovery Plan</span><span>{{ selectedItem.name_label }}</span>
              <span class="text-muted">Status</span><status-badge :status="selectedItem.status"></status-badge>
              <span class="text-muted">Enabled Hosts</span><span>{{ selectedItem.enabledHostCount }}</span>
              <span class="text-muted">Protected Workloads</span><span>{{ selectedItem.protectedVmCount }}</span>
              <span class="text-muted">At-Risk Workloads</span><span>{{ selectedItem.atRiskVmCount }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedItem.uuid || '-' }}</span>
            </div>
            <div class="detail-section">
              <div class="detail-section-title">Next Action</div>
              <div class="capacity-callout">
                <strong>{{ selectedItem.nextAction }}</strong>
                <p>Use this plan row to organize restore drills, standby capacity reviews, and operator readiness for each pool or protection domain.</p>
              </div>
            </div>
          </div>
        </floating-window>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      summary: {
        protectedVmCount: 0,
        atRiskVmCount: 0,
        maintenanceHostCount: 0,
        recoveryPlanCount: 0,
        recentEventCount: 0,
      },
      protectionPolicies: [],
      hostPlans: [],
      recoveryPlans: [],
      recentEvents: [],
      selectedItem: null,
      selectedItemType: '',
      showInspector: false,
    };
  },
  computed: {
    summaryCards() {
      return [
        {
          key: 'protected',
          label: 'Protected Workloads',
          value: String(this.summary.protectedVmCount || 0),
          detail: 'Workloads with recent successful resilience activity in the current window',
          icon: 'mdi-shield-check-outline',
          valueClass: (this.summary.protectedVmCount || 0) ? 'text-green' : '',
        },
        {
          key: 'risk',
          label: 'At-Risk Workloads',
          value: String(this.summary.atRiskVmCount || 0),
          detail: 'Workloads requiring protection review or alert follow-up',
          icon: 'mdi-alert-decagram-outline',
          valueClass: (this.summary.atRiskVmCount || 0) ? 'text-red' : 'text-green',
        },
        {
          key: 'maintenance',
          label: 'Maintenance Hosts',
          value: String(this.summary.maintenanceHostCount || 0),
          detail: 'Hosts that are disabled or staged for lifecycle work',
          icon: 'mdi-tools',
          valueClass: (this.summary.maintenanceHostCount || 0) ? 'text-amber' : 'text-green',
        },
        {
          key: 'events',
          label: 'Recovery Events',
          value: String(this.summary.recentEventCount || 0),
          detail: `${this.summary.recoveryPlanCount || 0} recovery plans currently tracked`,
          icon: 'mdi-history',
          valueClass: (this.summary.recentEventCount || 0) ? 'text-cyan' : 'text-green',
        },
      ];
    },
    prioritizedPolicies() {
      const priority = { critical: 0, warning: 1, pending: 2, success: 3, info: 4, notice: 5 };
      return [...this.protectionPolicies].sort((left, right) => {
        const statusDelta = (priority[left.status] ?? 99) - (priority[right.status] ?? 99);
        if (statusDelta !== 0) return statusDelta;
        return new Date(right.lastProtectedAt || 0) - new Date(left.lastProtectedAt || 0);
      });
    },
    prioritizedHosts() {
      const priority = { critical: 0, pending: 1, warning: 2, disabled: 3, success: 4, info: 5 };
      return [...this.hostPlans].sort((left, right) => (priority[left.status] ?? 99) - (priority[right.status] ?? 99));
    },
    prioritizedRecoveryPlans() {
      const priority = { critical: 0, warning: 1, pending: 2, success: 3, info: 4 };
      return [...this.recoveryPlans].sort((left, right) => (priority[left.status] ?? 99) - (priority[right.status] ?? 99));
    },
    inspectorTitle() {
      if (this.selectedItemType === 'policy') return 'Protection Policy Detail';
      if (this.selectedItemType === 'host') return 'Failover Host Detail';
      if (this.selectedItemType === 'plan') return 'Recovery Plan Detail';
      return 'Resilience Detail';
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    await this.loadResilience();
  },
  methods: {
    formatDateTime,
    truncateList,
    openInspector(type, item) {
      this.selectedItemType = type;
      this.selectedItem = item;
      this.showInspector = true;
    },
    closeInspector() {
      this.showInspector = false;
      this.selectedItem = null;
      this.selectedItemType = '';
    },
    async loadResilience() {
      this.loading = true;
      try {
        const result = await api.getResilience();
        this.summary = result.summary || this.summary;
        this.protectionPolicies = result.protectionPolicies || [];
        this.hostPlans = result.hostPlans || [];
        this.recoveryPlans = result.recoveryPlans || [];
        this.recentEvents = result.recentEvents || [];
      } catch (error) {
        console.error(error);
        this.protectionPolicies = [];
        this.hostPlans = [];
        this.recoveryPlans = [];
        this.recentEvents = [];
      } finally {
        this.loading = false;
      }
    },
  },
};

