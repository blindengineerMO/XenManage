const TemplateCreateForm = {
  props: {
    saving: Boolean,
    kind: { type: String, default: 'operating-system' },
    operatingSystems: { default: () => [] },
    virtualMachines: { default: () => [] },
  },
  emits: ['submit'],
  template: `<form class="template-create-form" @submit.prevent="submit">
    <div class="template-create-kind"><span class="mdi" :class="isOperatingSystem ? 'mdi-linux' : 'mdi-content-copy'"></span><div><div class="dash-card-label">{{ isOperatingSystem ? 'Operating-System Profile' : 'Deployable Golden Template' }}</div><p>{{ isOperatingSystem ? 'Copies a diskless installation profile for the New VM operating-system selector.' : 'Copies a halted VM, preserving the original VM and producing a reusable deployable image.' }}</p></div></div>
    <div class="form-group"><label>{{ isOperatingSystem ? 'Base Operating-System Profile' : 'Source Virtual Machine' }}</label><select class="form-input" v-model="draft.sourceRef" required><option value="">Select a source</option><option v-for="source in sources" :key="source.ref" :value="source.ref">{{ source.name_label }}{{ source.name_description ? ' - ' + source.name_description : '' }}</option></select><p class="field-help" v-if="!isOperatingSystem">Only halted VMs can be copied into golden templates. Attached installation media is removed from the copy.</p></div>
    <div class="vm-inline-form-grid"><div class="form-group"><label>Template Name</label><input class="form-input" v-model.trim="draft.nameLabel" required placeholder="ubuntu-24-standard"></div><div class="form-group"><label>Description</label><input class="form-input" v-model="draft.nameDescription" placeholder="Purpose, release, and hardening level"></div></div>
    <div class="form-group"><label>Tags</label><input class="form-input" v-model="tagsInput" placeholder="linux, standard, approved"></div>
    <div class="vm-wizard-note"><span class="mdi mdi-shield-check-outline"></span><span>{{ isOperatingSystem ? 'This creates a new diskless profile. It will appear only in the New VM operating-system selection.' : 'This creates a separate golden image. The source VM remains unchanged and the template will appear only in Deploy Template.' }}</span></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="saving || !canSubmit"><span class="mdi" :class="isOperatingSystem ? 'mdi-file-plus-outline' : 'mdi-content-copy'"></span>{{ saving ? 'Creating Template...' : (isOperatingSystem ? 'Create OS Profile' : 'Create Golden Template') }}</button></div>
  </form>`,
  data() { return { tagsInput: '', draft: { sourceRef: '', nameLabel: '', nameDescription: '' } }; },
  computed: {
    isOperatingSystem() { return this.kind === 'operating-system'; },
    sources() { return this.isOperatingSystem ? this.operatingSystems : this.virtualMachines.filter((vm) => String(vm.power_state || '').toLowerCase() === 'halted' && !vm.is_a_template && !vm.is_a_snapshot); },
    canSubmit() { return Boolean(this.draft.sourceRef && this.draft.nameLabel); },
  },
  watch: {
    sources: { immediate: true, handler(options) { if (!options.some((source) => source.ref === this.draft.sourceRef)) this.draft.sourceRef = options[0]?.ref || ''; } },
    kind() { this.draft.sourceRef = this.sources[0]?.ref || ''; },
  },
  methods: {
    submit() { if (this.canSubmit) this.$emit('submit', { ...this.draft, kind: this.kind, tags: this.tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean) }); },
  },
};
