const StorageCreateSrWindow = {
  components: {
    FloatingWindow,
    StorageSrCreateForm,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    availableHosts: {
      type: Array,
      default: () => [],
    },
    createSrBusy: {
      type: Boolean,
      default: false,
    },
    createSrProbeBusy: {
      type: Boolean,
      default: false,
    },
    createSrError: {
      type: String,
      default: '',
    },
    createSrProbeError: {
      type: String,
      default: '',
    },
    createSrImportError: {
      type: String,
      default: '',
    },
    createSrProbeResult: {
      type: Object,
      default: null,
    },
    createSrProbeRequest: {
      type: Object,
      default: null,
    },
    createSrImportBusyKey: {
      type: String,
      default: '',
    },
  },
  emits: ['close', 'submit', 'probe', 'introduce-probed-sr'],
  template: `
    <floating-window :show="show"
                     title="Create Storage Repository"
                     :width="860"
                     :height="620"
                     @close="$emit('close')">
      <div class="detail-section">
        <div class="detail-title">Provision Or Probe Repository</div>
        <p class="text-muted" style="margin-bottom:12px">Provision a new SR against NFS, iSCSI, local EXT, or local LVM, or probe an existing target to discover imported repository details before you create.</p>
        <storage-sr-create-form
          :hosts="availableHosts"
          :saving="createSrBusy"
          :probe-saving="createSrProbeBusy"
          :submit-label="'Create Storage Repository'"
          @submit="$emit('submit', $event)"
          @probe="$emit('probe', $event)">
        </storage-sr-create-form>
        <div class="form-error" v-if="createSrError" style="text-align:left;margin-top:12px">{{ createSrError }}</div>
        <div class="form-error" v-if="createSrProbeError" style="text-align:left;margin-top:12px">{{ createSrProbeError }}</div>
        <div class="form-error" v-if="createSrImportError" style="text-align:left;margin-top:12px">{{ createSrImportError }}</div>
        <div class="detail-section" v-if="createSrProbeResult" style="margin-top:16px">
          <div class="detail-section-title">Probe Discovery</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>{{ createSrProbeResult.mode === 'probe_ext' ? 'Structured repository probe returned' : 'Legacy repository probe returned' }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ describeSrProbeSummary(createSrProbeResult) }}</div>
              </div>
              <span class="badge" :class="createSrProbeResult.mode === 'probe_ext' ? 'badge-running' : 'badge-warning'">
                {{ createSrProbeResult.mode === 'probe_ext' ? 'structured' : 'legacy xml' }}
              </span>
            </div>
            <div class="stack-item" v-for="(result, index) in createSrProbeResult.results" :key="result.sr?.uuid || result.sr?.name_label || ('probe-' + index)">
              <div>
                <strong>{{ result.sr?.name_label || ('Candidate ' + (index + 1)) }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ result.complete ? 'Complete create-ready configuration discovered.' : 'Partial configuration returned. Refine the probe inputs and probe again.' }}
                </div>
                <div class="text-muted mono" style="font-size:11px">{{ formatProbeMap(result.configuration) || 'No configuration hints were returned.' }}</div>
                <div class="text-muted mono" v-if="formatProbeMap(result.extraInfo)" style="font-size:11px">{{ formatProbeMap(result.extraInfo) }}</div>
                <div class="text-muted mono" v-if="result.sr" style="font-size:11px">{{ formatProbeSrStat(result.sr) }}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <span class="badge badge-running" v-if="result.complete">complete</span>
                <span class="badge badge-warning" v-else>partial</span>
                <span class="badge badge-info" v-if="result.sr?.health">{{ result.sr.health }}</span>
                <button class="btn btn-sm btn-primary"
                        type="button"
                        v-if="canIntroduceProbedSr(result)"
                        :disabled="Boolean(createSrImportBusyKey)"
                        @click="$emit('introduce-probed-sr', result, index)">
                  <span class="mdi mdi-database-import-outline"></span>
                  {{ createSrImportBusyKey === buildProbeResultKey(result, index) ? 'Introducing...' : 'Introduce Or Attach' }}
                </button>
              </div>
            </div>
            <div class="capacity-callout" v-if="createSrProbeResult.rawXml">
              <strong>Legacy backend probe output</strong>
              <div class="text-muted mono" style="font-size:11px;margin-top:8px">This Xen host returned backend-specific XML rather than structured probe records. Review it to refine device configuration or identify an imported SR before creating a new repository.</div>
              <pre class="mono" style="margin-top:10px;white-space:pre-wrap;max-height:220px;overflow:auto">{{ createSrProbeResult.rawXml }}</pre>
            </div>
          </div>
        </div>
      </div>
    </floating-window>
  `,
  methods: {
    buildProbeResultKey: buildStorageProbeResultKey,
    canIntroduceProbedSr(result) {
      return canIntroduceStorageProbeResult(this.createSrProbeRequest, result);
    },
    describeSrProbeSummary: describeStorageProbeSummary,
    formatProbeMap: formatStorageProbeMap,
    formatProbeSrStat: formatStorageProbeStat,
  },
};
