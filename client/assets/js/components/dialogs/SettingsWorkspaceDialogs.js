const SettingsWorkspaceDialogs = {
  components: {
    FloatingWindow,
    RetentionPolicyForm,
    CredentialVaultForm,
  },
  props: {
    showPolicyEditor: { type: Boolean, default: false },
    selectedPolicy: { type: Object, default: null },
    policySaving: { type: Boolean, default: false },
    previewLoading: { type: Boolean, default: false },
    runLoading: { type: Boolean, default: false },
    showCredentialEditor: { type: Boolean, default: false },
    editingCredentialId: { type: [Number, String, null], default: null },
    credentialDraft: { type: Object, default: null },
    credentialSaving: { type: Boolean, default: false },
    credentialDeleteId: { type: [Number, null], default: null },
  },
  emits: [
    'close-policy-editor',
    'save-policy',
    'preview-retention',
    'run-retention',
    'close-credential-editor',
    'save-credential',
    'remove-credential',
  ],
  template: `
    <div>
      <floating-window :show="showPolicyEditor"
                       title="Retention Policy"
                       :width="720"
                       :height="500"
                       @close="$emit('close-policy-editor')">
        <div v-if="selectedPolicy">
          <div class="detail-section">
            <div class="detail-section-title">{{ selectedPolicy.label }}</div>
            <div class="capacity-callout">
              <strong>{{ selectedPolicy.description }}</strong>
              <div class="text-muted mono" style="font-size:11px;margin-top:8px">
                Domain key {{ selectedPolicy.domain }} · Last run {{ selectedPolicy.lastRunAt ? formatDateTime(selectedPolicy.lastRunAt) : 'never' }}
              </div>
            </div>
          </div>

          <retention-policy-form
            :initial-value="selectedPolicy"
            :saving="policySaving"
            submit-label="Save Retention Policy"
            @submit="$emit('save-policy', $event)">
          </retention-policy-form>

          <div class="form-actions" style="margin-top:12px">
            <button class="btn" :disabled="previewLoading" @click="$emit('preview-retention', selectedPolicy.domain)">
              <span class="mdi mdi-magnify-scan"></span>
              Preview This Domain
            </button>
            <button class="btn btn-primary" :disabled="runLoading" @click="$emit('run-retention', selectedPolicy.domain)">
              <span class="mdi mdi-broom"></span>
              Run This Domain
            </button>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showCredentialEditor"
                       :title="editingCredentialId ? 'Edit Vault Credential' : 'Add Vault Credential'"
                       :width="620"
                       :height="520"
                       @close="$emit('close-credential-editor')">
        <div>
          <div class="detail-section" v-if="editingCredentialId">
            <div class="detail-section-title">Credential Activity</div>
            <div class="property-grid">
              <span class="text-muted">Last Used</span><span>{{ credentialDraft?.lastUsedAt ? formatDateTime(credentialDraft.lastUsedAt) : 'Never' }}</span>
              <span class="text-muted">Updated</span><span>{{ credentialDraft?.updatedAt ? formatDateTime(credentialDraft.updatedAt) : formatDateTime(credentialDraft?.createdAt) }}</span>
              <span class="text-muted">Scope</span><span>{{ credentialDraft?.scope === 'shared' ? 'Shared' : 'Private' }}</span>
              <span class="text-muted">Target Type</span><span>{{ credentialDraft?.targetType === 'host' ? 'Host' : 'Pool' }}</span>
            </div>
          </div>

          <credential-vault-form
            :initial-value="credentialDraft"
            :saving="credentialSaving"
            :mode="editingCredentialId ? 'edit' : 'create'"
            :submit-label="editingCredentialId ? 'Save Credential Changes' : 'Save Vault Credential'"
            @submit="$emit('save-credential', $event)">
          </credential-vault-form>

          <div class="form-actions" v-if="editingCredentialId" style="margin-top:12px">
            <button class="btn"
                    :disabled="credentialDeleteId === editingCredentialId"
                    @click="$emit('remove-credential', credentialDraft)">
              <span class="mdi" :class="credentialDeleteId === editingCredentialId ? 'mdi-loading mdi-spin' : 'mdi-delete-outline'"></span>
              {{ credentialDeleteId === editingCredentialId ? 'Removing...' : 'Delete Credential' }}
            </button>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatDateTime,
  },
};
