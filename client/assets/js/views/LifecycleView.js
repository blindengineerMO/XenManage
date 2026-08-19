const LifecycleView = {
  components: { FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading lifecycle state, compliance hints, and maintenance tasks...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-shield-sync-outline"></span>
              Lifecycle
            </h2>
            <p class="section-subtitle">A lifecycle and compliance cockpit inspired by vCenter and SCVMM, focused on drift visibility, maintenance windows, and operator follow-through.</p>
          </div>
          <button class="btn btn-primary" @click="loadLifecycle">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>

        <div class="dashboard-hero lifecycle-hero">
          <div>
            <div class="dash-card-label">Lifecycle Manager</div>
            <h3>Compliance posture, maintenance prep, and drift review in one queue.</h3>
            <p>XenMange now turns hosts, background tasks, and alert context into a lifecycle workbench so operators can see which systems are aligned, under maintenance, or waiting for remediation.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/hosts')">
              <span class="mdi mdi-server"></span>
              Host Inventory
            </button>
            <button class="btn" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Lifecycle Tasks
            </button>
            <button class="btn" @click="$router.push('/alerts')">
              <span class="mdi mdi-bell-alert-outline"></span>
              Related Alerts
            </button>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card" v-for="card in lifecycleCards" :key="card.key">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
            <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Compliance Queue</div>
            <div class="stack-list" v-if="hostLifecycleRows.length">
              <button class="stack-item stack-item-button"
                      v-for="row in hostLifecycleRows"
                      :key="row.ref"
                      @click="openInspector(row)">
                <div class="capacity-item-main">
                  <strong>{{ row.name_label || row.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ row.address || row.uuid || row.ref }} · {{ row.maintenanceWindow }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ row.summary }}</div>
                </div>
                <status-badge :status="row.lifecycleStatus"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No hosts reported.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Lifecycle Tasks</div>
            <div class="stack-list" v-if="lifecycleTasks.length">
              <div class="stack-item" v-for="task in lifecycleTasks.slice(0, 8)" :key="task.ref">
                <div>
                  <strong>{{ task.name_label || 'Task' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatTaskProgress(task.progress) }} · {{ formatDateTime(task.finished || task.created) }}</div>
                </div>
                <status-badge :status="task.status || 'info'"></status-badge>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No lifecycle-oriented tasks in the current activity window.</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Maintenance Watch</div>
            <div class="metric-row">
              <span>Hosts In Maintenance</span>
              <strong class="text-amber">{{ maintenanceHosts.length }}</strong>
            </div>
            <div class="metric-row">
              <span>Hosts Requiring Review</span>
              <strong class="text-red">{{ actionHosts.length }}</strong>
            </div>
            <div class="metric-row">
              <span>Baseline Aligned</span>
              <strong class="text-green">{{ compliantHosts.length }} / {{ hosts.length }}</strong>
            </div>
            <div class="metric-row">
              <span>Recent Lifecycle Alerts</span>
              <strong class="text-cyan">{{ lifecycleAlerts.length }}</strong>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Remediation Guidance</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in recommendations" :key="item.title">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                </div>
                <status-badge :status="item.status"></status-badge>
              </div>
            </div>
          </div>
        </div>

        <floating-window :show="showInspector"
                         title="Lifecycle Detail"
                         :width="760"
                         :height="500"
                         @close="closeInspector">
          <div v-if="selectedHost">
            <div class="property-grid">
              <span class="text-muted">Host</span><span>{{ selectedHost.name_label || selectedHost.hostname || '-' }}</span>
              <span class="text-muted">Address</span><span class="mono">{{ selectedHost.address || '-' }}</span>
              <span class="text-muted">Lifecycle Status</span><status-badge :status="selectedHost.lifecycleStatus"></status-badge>
              <span class="text-muted">Maintenance Window</span><span>{{ selectedHost.maintenanceWindow }}</span>
              <span class="text-muted">Lifecycle Hint</span><span>{{ selectedHost.lifecycleHint }}</span>
              <span class="text-muted">Recent Task</span><span class="property-wrap">{{ selectedHost.lastTaskLabel }}</span>
              <span class="text-muted">Recent Alert</span><span class="property-wrap">{{ selectedHost.lastAlertLabel }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedHost.uuid || '-' }}</span>
              <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedHost.other_config || {}) }}</span>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Recommended Action</div>
              <div class="capacity-callout">
                <strong>{{ selectedHost.summary }}</strong>
                <p>{{ selectedHost.recommendation }}</p>
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
      hosts: [],
      tasks: [],
      messages: [],
      selectedHost: null,
      showInspector: false,
    };
  },
  computed: {
    lifecycleTasks() {
      return sortTasks(this.tasks.filter((task) => this.isLifecycleTask(task)));
    },
    lifecycleAlerts() {
      return sortMessages(this.messages.filter((message) => this.isLifecycleAlert(message)));
    },
    hostLifecycleRows() {
      const priority = { critical: 0, pending: 1, warning: 2, disabled: 3, success: 4, notice: 5, info: 6 };

      return [...this.hosts.map((host) => this.buildHostLifecycleRow(host))]
        .sort((left, right) => {
          const statusDelta = (priority[left.lifecycleStatus] ?? 99) - (priority[right.lifecycleStatus] ?? 99);
          if (statusDelta !== 0) return statusDelta;
          return left.name_label.localeCompare(right.name_label);
        });
    },
    compliantHosts() {
      return this.hostLifecycleRows.filter((row) => row.lifecycleStatus === 'success');
    },
    maintenanceHosts() {
      return this.hostLifecycleRows.filter((row) => row.lifecycleStatus === 'disabled' || row.lifecycleHint === 'maintenance');
    },
    actionHosts() {
      return this.hostLifecycleRows.filter((row) => ['critical', 'warning', 'pending'].includes(row.lifecycleStatus));
    },
    lifecycleCards() {
      return [
        {
          key: 'aligned',
          label: 'Baseline Aligned',
          value: `${this.compliantHosts.length}/${this.hosts.length}`,
          detail: this.compliantHosts.length ? `${this.compliantHosts[0].name_label || 'Host'} is the leading compliant node` : 'No hosts are currently marked aligned',
          icon: 'mdi-shield-check-outline',
          valueClass: this.compliantHosts.length ? 'text-green' : 'text-amber',
        },
        {
          key: 'review',
          label: 'Needs Review',
          value: String(this.actionHosts.length),
          detail: this.actionHosts.length ? `${this.actionHosts[0].name_label || 'Host'} is highest priority` : 'No lifecycle review backlog detected',
          icon: 'mdi-clipboard-alert-outline',
          valueClass: this.actionHosts.length ? 'text-amber' : 'text-green',
        },
        {
          key: 'maintenance',
          label: 'Maintenance Windows',
          value: String(this.maintenanceHosts.length),
          detail: this.maintenanceHosts.length ? 'One or more hosts are staged for lifecycle work' : 'No hosts currently marked for maintenance',
          icon: 'mdi-tools',
          valueClass: this.maintenanceHosts.length ? 'text-cyan' : 'text-green',
        },
        {
          key: 'jobs',
          label: 'Lifecycle Jobs',
          value: String(this.lifecycleTasks.filter((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase())).length),
          detail: this.lifecycleTasks.length ? 'Compliance scans and lifecycle activity are being tracked' : 'No lifecycle jobs detected in recent history',
          icon: 'mdi-progress-wrench',
          valueClass: this.lifecycleTasks.length ? 'text-cyan' : 'text-green',
        },
      ];
    },
    recommendations() {
      const items = [];

      if (this.actionHosts.length) {
        const host = this.actionHosts[0];
        items.push({
          title: 'Review lifecycle drift',
          detail: `${host.name_label || 'Host'} is flagged as ${host.lifecycleStatus} and should be reviewed before the next maintenance cycle.`,
          status: host.lifecycleStatus,
        });
      }

      if (this.maintenanceHosts.length) {
        const host = this.maintenanceHosts[0];
        items.push({
          title: 'Confirm maintenance readiness',
          detail: `${host.name_label || 'Host'} is already in or approaching a maintenance state. Validate evacuation, snapshot, and reboot prerequisites.`,
          status: 'warning',
        });
      }

      if (this.lifecycleTasks.length) {
        const task = this.lifecycleTasks[0];
        items.push({
          title: 'Watch active lifecycle jobs',
          detail: `${task.name_label || 'Task'} should be monitored through completion so its result can update the compliance queue.`,
          status: task.status || 'pending',
        });
      }

      if (!items.length) {
        items.push({
          title: 'Lifecycle posture healthy',
          detail: 'No obvious lifecycle drift was inferred from the current hosts, messages, and activity stream.',
          status: 'success',
        });
      }

      return items;
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    await this.loadLifecycle();
  },
  methods: {
    formatDateTime,
    formatTaskProgress,
    isLifecycleTask(task) {
      const haystack = `${task?.name_label || ''} ${task?.name_description || ''}`.toLowerCase();
      return /(patch|compliance|scan|baseline|maintenance|update|drift|reboot|remediat|firmware|lifecycle)/.test(haystack);
    },
    isLifecycleAlert(message) {
      const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();
      return /(maintenance|patch|compliance|drift|host|baseline|update|firmware)/.test(haystack);
    },
    hostMatchesTask(host, task) {
      const haystack = `${task?.name_label || ''} ${task?.name_description || ''} ${task?.resident_on || ''}`.toLowerCase();
      return haystack.includes((host.ref || '').toLowerCase())
        || haystack.includes((host.uuid || '').toLowerCase())
        || haystack.includes((host.name_label || '').toLowerCase())
        || haystack.includes((host.hostname || '').toLowerCase());
    },
    hostMatchesMessage(host, message) {
      const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
      return haystack.includes((host.uuid || '').toLowerCase())
        || haystack.includes((host.name_label || '').toLowerCase())
        || haystack.includes((host.hostname || '').toLowerCase());
    },
    buildHostLifecycleRow(host) {
      const relatedTasks = this.lifecycleTasks.filter((task) => this.hostMatchesTask(host, task));
      const relatedMessages = this.lifecycleAlerts.filter((message) => this.hostMatchesMessage(host, message));
      const lifecycleText = `${host?.other_config?.lifecycle || ''} ${(host.tags || []).join(' ')}`.toLowerCase();
      const maintenanceWindow = host?.other_config?.maintenance_window || 'No window defined';
      let lifecycleStatus = 'warning';
      let lifecycleHint = 'review';
      let summary = 'Baseline review recommended.';
      let recommendation = 'Validate patch level, maintenance readiness, and any desired-state drift before the next maintenance cycle.';

      if (!host.enabled || lifecycleText.includes('maintenance') || (host.tags || []).some((tag) => String(tag).toLowerCase().includes('maintenance'))) {
        lifecycleStatus = 'disabled';
        lifecycleHint = 'maintenance';
        summary = 'Host is in maintenance or pre-maintenance posture.';
        recommendation = 'Confirm evacuation, snapshot coverage, and patch window details before taking further action.';
      } else if (relatedTasks.some((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()))) {
        lifecycleStatus = 'pending';
        lifecycleHint = 'scanning';
        summary = 'Lifecycle work is currently in progress.';
        recommendation = 'Allow the active compliance or maintenance task to complete, then reassess drift and baseline health.';
      } else if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical')) {
        lifecycleStatus = 'critical';
        lifecycleHint = 'risk';
        summary = 'Critical lifecycle or maintenance signal detected.';
        recommendation = 'Investigate the related alert before scheduling further remediation so lifecycle work does not amplify an existing fault.';
      } else if (/(patched|compliant|managed|current)/.test(lifecycleText)) {
        lifecycleStatus = 'success';
        lifecycleHint = 'aligned';
        summary = 'Host appears aligned with the expected lifecycle posture.';
        recommendation = 'Keep this host in the compliant set and use it as a preferred target when draining or rebalancing adjacent nodes.';
      } else if (relatedMessages.length) {
        lifecycleStatus = 'warning';
        lifecycleHint = 'attention';
        summary = 'Recent lifecycle-adjacent alerts suggest review is needed.';
        recommendation = 'Inspect the alert context and confirm whether a patch, reboot, or maintenance action should be scheduled.';
      }

      return {
        ...host,
        lifecycleStatus,
        lifecycleHint,
        maintenanceWindow,
        summary,
        recommendation,
        relatedTasks,
        relatedMessages,
        lastTaskLabel: relatedTasks[0]?.name_label || 'No recent lifecycle task',
        lastAlertLabel: relatedMessages[0] ? getMessageHeadline(relatedMessages[0]) : 'No recent lifecycle alert',
      };
    },
    openInspector(row) {
      this.selectedHost = row;
      this.showInspector = true;
    },
    closeInspector() {
      this.showInspector = false;
      this.selectedHost = null;
    },
    async loadLifecycle() {
      this.loading = true;
      try {
        const [hostsResult, tasksResult, messagesResult] = await Promise.all([
          api.getHosts(),
          api.getTasks(),
          api.dashboardMessages(),
        ]);

        this.hosts = hostsResult.data || [];
        this.tasks = tasksResult.data || [];
        this.messages = messagesResult || [];
      } catch (error) {
        console.error(error);
        this.hosts = [];
        this.tasks = [];
        this.messages = [];
      } finally {
        this.loading = false;
      }
    },
  },
};

