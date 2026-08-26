const axios = require('axios');
const config = require('../config');

let rpcId = 0;

function createXenApiError(code, message = code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

class XenAPI {
  constructor(host) {
    this.host = host;
    this.baseUrl = `https://${host}/jsonrpc`;
    this.sessionRef = null;
    this.client = axios.create({
      timeout: config.xen.requestTimeout,
      headers: { 'Content-Type': 'application/json' },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });
  }

  async rpc(method, params = []) {
    rpcId += 1;
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id: rpcId,
    };

    const response = await this.client.post(this.baseUrl, payload);
    const data = response.data;

    if (data.error) {
      const err = new Error(data.error.message || 'XENAPI_ERROR');
      err.code = data.error.message;
      err.data = data.error.data;
      throw err;
    }

    return data.result;
  }

  async login(username, password) {
    const sessionRef = await this.rpc('session.login_with_password', [
      username,
      password,
      config.xen.defaultVersion,
      config.xen.defaultOriginator,
    ]);
    this.sessionRef = sessionRef;
    return sessionRef;
  }

  async logout() {
    if (this.sessionRef) {
      try {
        await this.rpc('session.logout', [this.sessionRef]);
      } catch (e) {
        // Session may already be expired
      }
      this.sessionRef = null;
    }
  }

  async call(className, methodName, params = []) {
    if (!this.sessionRef) {
      throw new Error('NOT_AUTHENTICATED');
    }
    return this.rpc(`${className}.${methodName}`, [this.sessionRef, ...params]);
  }

  async getAllRecords(className) {
    return this.call(className, 'get_all_records');
  }

  async getRecord(className, ref) {
    return this.call(className, 'get_record', [ref]);
  }

  async getField(className, ref, field) {
    return this.call(className, `get_${field}`, [ref]);
  }

  async setField(className, ref, field, value) {
    return this.call(className, `set_${field}`, [ref, value]);
  }

  async destroy(className, ref) {
    return this.call(className, 'destroy', [ref]);
  }

  async create(className, params) {
    return this.call(className, 'create', [params]);
  }

  async getClassRecords(className) {
    const records = await this.getAllRecords(className);
    return {
      refs: Object.keys(records),
      records,
    };
  }

  // Convenience methods
  async getPools() {
    return this.getClassRecords('pool');
  }

  async getHosts() {
    return this.getClassRecords('host');
  }

  async disableHost(ref, autoEnable = false) {
    return this.call('host', 'disable', [ref, Boolean(autoEnable)]);
  }

  async enableHost(ref) {
    return this.call('host', 'enable', [ref]);
  }

  async assertCanEvacuateHost(ref) {
    return this.call('host', 'assert_can_evacuate', [ref]);
  }

  async evacuateHost(ref, networkRef, evacuateBatchSize = 0) {
    return this.call('host', 'evacuate', [ref, networkRef, Number(evacuateBatchSize || 0)]);
  }

  async rebootHost(ref) {
    return this.call('host', 'reboot', [ref]);
  }

  async shutdownHost(ref) {
    return this.call('host', 'shutdown', [ref]);
  }

  async enterHostMaintenance(ref, {
    networkRef,
    evacuateBatchSize = 0,
    evacuateRunningVms = true,
  } = {}) {
    await this.disableHost(ref, false);

    try {
      if (evacuateRunningVms) {
        await this.assertCanEvacuateHost(ref);
        await this.evacuateHost(ref, networkRef, evacuateBatchSize);
      }
    } catch (error) {
      try {
        await this.enableHost(ref);
      } catch (rollbackError) {
        // Preserve the original evacuation failure while attempting a safe rollback.
      }
      throw error;
    }

    const record = await this.getRecord('host', ref);
    return {
      ref,
      maintenance_mode: true,
      maintenanceNetworkRef: networkRef,
      evacuated: Boolean(evacuateRunningVms),
      ...record,
    };
  }

  async exitHostMaintenance(ref) {
    await this.enableHost(ref);
    const record = await this.getRecord('host', ref);
    return {
      ref,
      maintenance_mode: false,
      ...record,
    };
  }

  async getVMs() {
    return this.getClassRecords('VM');
  }

  async getSRs() {
    return this.getClassRecords('SR');
  }

  async rescanSR(ref) {
    await this.call('SR', 'scan', [ref]);
    const record = await this.getRecord('SR', ref);
    return {
      ref,
      ...record,
    };
  }

  async repairSR(ref) {
    await this.call('SR', 'update', [ref]);

    const currentRecord = await this.getRecord('SR', ref);
    const pbdRefs = Array.isArray(currentRecord?.PBDs) ? currentRecord.PBDs : [];
    const repairedPbdRefs = [];

    for (const pbdRef of pbdRefs) {
      const pbdRecord = await this.getRecord('PBD', pbdRef);
      if (pbdRecord?.currently_attached === false) {
        await this.call('PBD', 'plug', [pbdRef]);
        repairedPbdRefs.push(pbdRef);
      }
    }

    await this.call('SR', 'scan', [ref]);
    const record = await this.getRecord('SR', ref);
    return {
      ref,
      checkedPbdRefs: pbdRefs,
      repairedPbdRefs,
      reattachedCount: repairedPbdRefs.length,
      ...record,
    };
  }

  async forgetSR(ref) {
    await this.call('SR', 'forget', [ref]);
    return {
      success: true,
      ref,
    };
  }

  async destroySR(ref) {
    await this.destroy('SR', ref);
    return {
      success: true,
      ref,
    };
  }

  async createStorageRepository({
    hostRef,
    nameLabel,
    nameDescription = '',
    type,
    contentType = 'user',
    shared = false,
    deviceConfig = {},
    smConfig = {},
  } = {}) {
    const normalizeMap = (record = {}) => Object.fromEntries(
      Object.entries(record || {})
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim())
        .map(([key, value]) => [String(key).trim(), String(value).trim()])
    );

    const srRef = await this.call('SR', 'create', [
      hostRef,
      normalizeMap(deviceConfig),
      0,
      String(nameLabel || '').trim(),
      String(nameDescription || '').trim(),
      String(type || '').trim(),
      String(contentType || 'user').trim(),
      Boolean(shared),
      normalizeMap(smConfig),
    ]);

    const record = await this.getRecord('SR', srRef);
    return {
      ref: srRef,
      ...record,
    };
  }

  async createStorageVdi(ref, {
    nameLabel,
    sizeBytes,
    type = 'user',
  } = {}) {
    const vdiRef = await this.create('VDI', {
      name_label: nameLabel,
      name_description: '',
      SR: ref,
      virtual_size: String(sizeBytes),
      type: String(type || 'user'),
      sharable: false,
      read_only: false,
      other_config: {},
      xenstore_data: {},
      sm_config: {},
      tags: [],
    });

    const record = await this.getRecord('VDI', vdiRef);
    return {
      ref: vdiRef,
      ...record,
    };
  }

  async resizeStorageVdi(ref, sizeBytes) {
    await this.call('VDI', 'resize', [ref, String(sizeBytes)]);
    const record = await this.getRecord('VDI', ref);
    return {
      ref,
      ...record,
    };
  }

  async deleteStorageVdi(ref) {
    await this.destroy('VDI', ref);
    return {
      success: true,
      ref,
    };
  }

  async getNetworks() {
    return this.getClassRecords('network');
  }

  // VM lifecycle
  async startVM(ref, paused = false, force = false) {
    return this.call('VM', 'start', [ref, paused, force]);
  }

  async shutdownVM(ref, force = false) {
    if (force) {
      return this.call('VM', 'hard_shutdown', [ref]);
    }
    return this.call('VM', 'clean_shutdown', [ref]);
  }

  async rebootVM(ref, force = false) {
    if (force) {
      return this.call('VM', 'hard_reboot', [ref]);
    }
    return this.call('VM', 'clean_reboot', [ref]);
  }

  async suspendVM(ref) {
    return this.call('VM', 'suspend', [ref]);
  }

  async resumeVM(ref, paused = false) {
    return this.call('VM', 'resume', [ref, false, paused]);
  }

  async cloneVM(ref, nameLabel) {
    return this.call('VM', 'clone', [ref, nameLabel]);
  }

  async copyVM(ref, nameLabel, srRef) {
    return this.call('VM', 'copy', [ref, nameLabel, srRef]);
  }

  async duplicateVM(ref, {
    nameLabel,
    nameDescription = '',
    mode = 'clone',
    srRef = '',
    startAfter = false,
  }) {
    const nextVmRef = mode === 'copy'
      ? await this.copyVM(ref, nameLabel, srRef)
      : await this.cloneVM(ref, nameLabel);

    if (nameDescription) {
      await this.setField('VM', nextVmRef, 'name_description', nameDescription);
    }

    if (startAfter) {
      await this.startVM(nextVmRef, false, false);
    }

    const record = await this.getRecord('VM', nextVmRef);
    return {
      ref: nextVmRef,
      duplication_mode: mode === 'copy' ? 'copy' : 'clone',
      targetSrRef: srRef || '',
      ...record,
    };
  }

  buildHttpOperationUrl(pathName, params = {}) {
    const url = new URL(`https://${this.host}/${String(pathName || '').replace(/^\/+/, '')}`);
    Object.entries({
      session_id: this.sessionRef,
      ...params,
    }).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  async exportVM(ref, { metadataOnly = false } = {}) {
    const url = this.buildHttpOperationUrl(metadataOnly ? 'export_metadata' : 'export', { ref });
    const response = await this.client.request({
      method: 'GET',
      url,
      responseType: 'stream',
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`VM_EXPORT_FAILED (${response.status})`);
      error.code = 'VM_EXPORT_FAILED';
      error.status = response.status;
      throw error;
    }

    return response;
  }

  async importVM(stream, {
    srRef = '',
    restore = false,
    force = false,
    metadataOnly = false,
    contentLength = '',
  } = {}) {
    const url = this.buildHttpOperationUrl(metadataOnly ? 'import_metadata' : 'import', {
      sr_id: metadataOnly ? '' : srRef,
      restore: restore ? 'true' : '',
      force: force ? 'true' : '',
    });

    const response = await this.client.request({
      method: 'PUT',
      url,
      data: stream,
      responseType: 'text',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(response.data || `VM_IMPORT_FAILED (${response.status})`);
      error.code = 'VM_IMPORT_FAILED';
      error.status = response.status;
      throw error;
    }

    return response;
  }

  async getRrdUpdates({ start = 0, cf = 'AVERAGE', interval = 60, host = false } = {}) {
    const normalizedStart = Math.max(0, Number(start || 0));
    const normalizedInterval = Math.max(1, Number(interval || 60));
    const normalizedCf = String(cf || 'AVERAGE').trim().toUpperCase() || 'AVERAGE';
    const url = this.buildHttpOperationUrl('rrd_updates', {
      start: normalizedStart,
      cf: normalizedCf,
      interval: normalizedInterval,
      ...(host ? { host: 'true' } : {}),
      json: 'true',
    });

    const response = await this.client.request({
      method: 'GET',
      url,
      responseType: 'json',
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`RRD_UPDATES_FAILED (${response.status})`);
      error.code = 'RRD_UPDATES_FAILED';
      error.status = response.status;
      throw error;
    }

    return response.data;
  }

  async migrateVM(ref, {
    hostRef,
    live = true,
    force = false,
    compress = true,
    setAsHomeServer = false,
  }) {
    const previousRecord = await this.getRecord('VM', ref);
    const powerState = String(previousRecord?.power_state || '').toLowerCase();
    const liveEligible = powerState === 'running' || powerState === 'suspended';
    const normalizedLive = liveEligible ? Boolean(live) : false;

    await this.call('VM', 'pool_migrate', [ref, hostRef, {
      force: String(Boolean(force)),
      live: String(normalizedLive),
      copy: 'false',
      compress: String(liveEligible ? Boolean(compress) : false),
    }]);

    let homeServerUpdated = false;
    let homeServerUpdateError = '';
    if (setAsHomeServer) {
      try {
        await this.setField('VM', ref, 'affinity', hostRef);
        homeServerUpdated = true;
      } catch (error) {
        homeServerUpdateError = error.message || 'HOME_SERVER_UPDATE_FAILED';
      }
    }

    const record = await this.getRecord('VM', ref);
    return {
      ref,
      migration_mode: normalizedLive ? 'live' : 'relocate',
      migrated_to: hostRef,
      homeServerUpdated,
      homeServerUpdateError,
      ...record,
    };
  }

  async migrateReceive(hostRef, networkRef, options = {}) {
    return this.call('host', 'migrate_receive', [hostRef, networkRef, options]);
  }

  async assertCanMigrate(ref, destinationMap, {
    live = false,
    vdiMap = {},
    vifMap = {},
    options = {},
    vgpuMap = {},
  } = {}) {
    return this.call('VM', 'assert_can_migrate', [
      ref,
      destinationMap,
      Boolean(live),
      vdiMap,
      vifMap,
      options,
      vgpuMap,
    ]);
  }

  async migrateSend(ref, destinationMap, {
    live = false,
    vdiMap = {},
    vifMap = {},
    options = {},
    vgpuMap = {},
  } = {}) {
    return this.call('VM', 'migrate_send', [
      ref,
      destinationMap,
      Boolean(live),
      vdiMap,
      vifMap,
      options,
      vgpuMap,
    ]);
  }

  collectOpaqueRefs(value, bucket = new Set()) {
    if (typeof value === 'string' && value.startsWith('OpaqueRef:')) {
      bucket.add(value);
      return [...bucket];
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => this.collectOpaqueRefs(entry, bucket));
      return [...bucket];
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach((entry) => this.collectOpaqueRefs(entry, bucket));
    }

    return [...bucket];
  }

  async findVmOnTarget(targetApi, {
    ref = '',
    uuid = '',
    nameLabel = '',
  } = {}) {
    const normalizedRef = String(ref || '').trim();
    const normalizedUuid = String(uuid || '').trim().toLowerCase();
    const normalizedName = String(nameLabel || '').trim().toLowerCase();

    if (normalizedRef) {
      try {
        const record = await targetApi.getRecord('VM', normalizedRef);
        return { ref: normalizedRef, record };
      } catch (error) {
        // Fall through to inventory search if the direct ref is not available on the destination.
      }
    }

    const result = await targetApi.getVMs();
    const records = Object.entries(result.records || {}).map(([vmRef, record]) => ({ ref: vmRef, ...record }));

    const directMatch = records.find((record) => normalizedUuid && String(record.uuid || '').toLowerCase() === normalizedUuid);
    if (directMatch) {
      return { ref: directMatch.ref, record: directMatch };
    }

    const nameMatch = records.find((record) => normalizedName && String(record.name_label || '').trim().toLowerCase() === normalizedName);
    if (nameMatch) {
      return { ref: nameMatch.ref, record: nameMatch };
    }

    return null;
  }

  async migrateVMToTarget(ref, destinationApi, {
    destinationTargetKey = '',
    transferNetworkRef = '',
    srRef = '',
    vifNetworkMap = [],
    live = true,
    copy = false,
  } = {}) {
    if (!destinationApi) {
      throw createXenApiError('DESTINATION_TARGET_NOT_CONNECTED', 'The destination live target could not be resolved.');
    }

    const previousRecord = await this.getRecord('VM', ref);
    const powerState = String(previousRecord?.power_state || '').toLowerCase();
    const liveEligible = powerState === 'running' || powerState === 'suspended';
    const normalizedCopy = Boolean(copy);
    const normalizedLive = liveEligible && !normalizedCopy ? Boolean(live) : false;

    if (normalizedCopy && normalizedLive) {
      throw createXenApiError('VM_COPY_LIVE_CONFLICT', 'Cross-pool copy mode cannot be combined with live migration.');
    }

    const destinationPoolsResult = await destinationApi.getPools();
    const destinationPools = Object.entries(destinationPoolsResult.records || {}).map(([poolRef, record]) => ({ ref: poolRef, ...record }));
    const destinationPool = destinationPools.find((pool) =>
      pool.default_SR === srRef || pool.migration_network === transferNetworkRef
    ) || destinationPools[0] || null;

    let destinationCoordinatorRef = String(destinationPool?.master || '').trim();
    if (!destinationCoordinatorRef) {
      const destinationHostsResult = await destinationApi.getHosts();
      destinationCoordinatorRef = destinationHostsResult.refs?.[0]
        || Object.keys(destinationHostsResult.records || {})[0]
        || '';
    }

    if (!destinationCoordinatorRef) {
      throw createXenApiError('DESTINATION_COORDINATOR_NOT_FOUND', 'No destination coordinator host could be resolved for the selected target.');
    }

    const destinationMap = await destinationApi.migrateReceive(destinationCoordinatorRef, transferNetworkRef, {});

    const sourceVifRefs = Array.isArray(previousRecord?.VIFs) ? previousRecord.VIFs.filter(Boolean) : [];
    const vifMap = {};
    (Array.isArray(vifNetworkMap) ? vifNetworkMap : []).forEach((entry) => {
      const vifRef = String(entry?.vifRef || '').trim();
      const networkRef = String(entry?.networkRef || '').trim();
      if (!vifRef || !networkRef) return;
      vifMap[vifRef] = networkRef;
    });

    const missingVifMappings = sourceVifRefs.filter((vifRef) => !vifMap[vifRef]);
    if (missingVifMappings.length) {
      throw createXenApiError('VM_MIGRATION_VIF_MAPPING_INCOMPLETE', 'One or more virtual interfaces do not have a destination network mapping.');
    }

    const sourceVbdRefs = Array.isArray(previousRecord?.VBDs) ? previousRecord.VBDs.filter(Boolean) : [];
    const vbdRecords = await Promise.all(sourceVbdRefs.map((vbdRef) =>
      this.getRecord('VBD', vbdRef).catch(() => null)
    ));
    const vdiRefs = vbdRecords
      .filter(Boolean)
      .filter((record) => String(record.type || '').toLowerCase() !== 'cd')
      .filter((record) => !record.empty)
      .map((record) => String(record.VDI || '').trim())
      .filter(Boolean);

    const vdiMap = Object.fromEntries(vdiRefs.map((vdiRef) => [vdiRef, srRef]));
    const options = normalizedCopy ? { copy: 'true' } : {};

    await this.assertCanMigrate(ref, destinationMap, {
      live: normalizedLive,
      vdiMap,
      vifMap,
      options,
      vgpuMap: {},
    });

    const migrateResult = await this.migrateSend(ref, destinationMap, {
      live: normalizedLive,
      vdiMap,
      vifMap,
      options,
      vgpuMap: {},
    });

    const opaqueRefs = this.collectOpaqueRefs(migrateResult);
    const directDestinationRef = opaqueRefs.find((opaqueRef) => opaqueRef !== ref) || opaqueRefs[0] || '';
    const destinationVmMatch = await this.findVmOnTarget(destinationApi, {
      ref: directDestinationRef,
      uuid: previousRecord?.uuid || '',
      nameLabel: previousRecord?.name_label || '',
    }).catch(() => null);

    const destinationRecord = destinationVmMatch?.record || null;
    const destinationVmRef = destinationVmMatch?.ref || directDestinationRef || '';

    return {
      ...(destinationRecord || previousRecord || { ref }),
      ref: destinationVmRef || ref,
      migration_mode: normalizedCopy ? 'cross-pool-copy' : (normalizedLive ? 'cross-pool-live' : 'cross-pool-relocate'),
      destinationTargetKey: String(destinationTargetKey || '').trim(),
      destinationCoordinatorRef,
      destinationPoolRef: destinationPool?.ref || '',
      destinationVmRef,
      destinationVmUuid: destinationRecord?.uuid || previousRecord?.uuid || '',
      transferNetworkRef,
      targetSrRef: srRef,
      homeServerUpdated: false,
      homeServerUpdateError: '',
      vifMappedCount: Object.keys(vifMap).length,
      vdiMappedCount: Object.keys(vdiMap).length,
      migrationResult: migrateResult,
    };
  }

  buildConsoleLocationUrl(location = '') {
    const rawLocation = String(location || '').trim();
    if (!rawLocation) {
      throw createXenApiError('VM_CONSOLE_LOCATION_MISSING', 'This console record does not expose a launch location.', 409);
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawLocation);
    } catch (error) {
      targetUrl = new URL(rawLocation.replace(/^\/+/, ''), `https://${this.host}/`);
    }

    if (!/^https?:$/i.test(targetUrl.protocol)) {
      throw createXenApiError('VM_CONSOLE_PROTOCOL_UNSUPPORTED', 'Only HTTP(S)-addressable console launch URLs are currently supported.', 409);
    }

    if (!targetUrl.searchParams.get('session_id') && this.sessionRef) {
      targetUrl.searchParams.set('session_id', this.sessionRef);
    }

    return targetUrl;
  }

  async getVMConsoles(ref) {
    const consoleRefs = await this.call('VM', 'get_consoles', [ref]).catch(() => []);
    const consoleRecords = await Promise.all((Array.isArray(consoleRefs) ? consoleRefs : []).map(async (consoleRef) => {
      const record = await this.getRecord('console', consoleRef);
      let absoluteLocation = '';
      try {
        absoluteLocation = this.buildConsoleLocationUrl(record?.location || '').toString();
      } catch (error) {
        absoluteLocation = '';
      }

      return {
        ref: consoleRef,
        ...record,
        absoluteLocation,
      };
    }));

    return consoleRecords;
  }

  async assertCanBootHere(ref, hostRef) {
    return this.call('VM', 'assert_can_boot_here', [ref, hostRef]);
  }

  async getVMCompatibility(ref) {
    const vmRecord = await this.getRecord('VM', ref);
    const hostsResult = await this.getHosts();
    const hostRecords = Object.entries(hostsResult.records || {}).map(([hostRef, record]) => ({ ref: hostRef, ...record }));
    const possibleHosts = await this.call('VM', 'get_possible_hosts', [ref]).catch(() => []);
    const possibleHostRefs = new Set(Array.isArray(possibleHosts) ? possibleHosts : []);
    const currentHostRef = String(vmRecord?.resident_on || vmRecord?.affinity || '').trim();
    const currentHostRecord = hostRecords.find((host) => host.ref === currentHostRef) || null;
    const currentCpuModel = String(currentHostRecord?.cpu_info?.modelname || '').trim().toLowerCase();

    const hosts = await Promise.all(hostRecords.map(async (host) => {
      let compatible = false;
      let compatibilityError = '';

      try {
        await this.assertCanBootHere(ref, host.ref);
        compatible = true;
      } catch (error) {
        compatibilityError = error.code || error.message || 'HOST_COMPATIBILITY_CHECK_FAILED';
      }

      const hostCpuModel = String(host?.cpu_info?.modelname || '').trim();
      const sameCpuFamily = currentCpuModel
        ? hostCpuModel.toLowerCase() === currentCpuModel
        : true;

      let readiness = 'compatible';
      if (!host.enabled || host.maintenance_mode) {
        readiness = 'maintenance';
      } else if (!compatible) {
        readiness = 'incompatible';
      } else if (!possibleHostRefs.has(host.ref)) {
        readiness = 'review';
      }

      return {
        ref: host.ref,
        uuid: host.uuid || '',
        name_label: host.name_label || host.hostname || host.ref,
        address: host.address || '',
        enabled: Boolean(host.enabled),
        maintenance_mode: Boolean(host.maintenance_mode),
        pool: host.pool || '',
        currentResident: host.ref === currentHostRef,
        possiblePlacement: possibleHostRefs.has(host.ref),
        compatible,
        readiness,
        compatibilityError,
        sameCpuFamily,
        cpuModel: hostCpuModel,
        cpuCount: Number(host?.cpu_info?.cpu_count || 0) || 0,
        socketCount: Number(host?.cpu_info?.socket_count || 0) || 0,
      };
    }));

    return {
      ref,
      uuid: vmRecord?.uuid || '',
      name_label: vmRecord?.name_label || ref,
      power_state: vmRecord?.power_state || '',
      resident_on: vmRecord?.resident_on || '',
      affinity: vmRecord?.affinity || '',
      hardwarePlatformVersion: Number(vmRecord?.hardware_platform_version || 0) || 0,
      lastBootCpuFlags: vmRecord?.last_boot_CPU_flags || {},
      possibleHostRefs: [...possibleHostRefs],
      hosts,
      maskingApiAvailable: false,
    };
  }

  async deployTemplate(ref, {
    nameLabel,
    nameDescription = '',
    hostRef = null,
    storageRef = null,
    networkRef = null,
    vcpus,
    memoryStaticMax,
    tags = [],
    startAfter = false,
  }) {
    const vmRef = await this.cloneVM(ref, nameLabel);

    await this.updateVMConfig(vmRef, {
      nameLabel,
      nameDescription,
      vcpus,
      memoryStaticMax,
      tags,
    });

    if (hostRef) {
      await this.setField('VM', vmRef, 'affinity', hostRef);
    }

    if (networkRef) {
      try {
        await this.addVMNic(vmRef, { networkRef, deviceLabel: '', mac: '' });
      } catch (error) {
        // Some templates may already contain a NIC or defer network edits until later.
      }
    }

    if (startAfter) {
      await this.startVM(vmRef, false, false);
    }

    const record = await this.getRecord('VM', vmRef);
    return { ref: vmRef, storageRef, ...record };
  }

  async getVMMetrics(ref) {
    const metricsRef = await this.getField('VM', ref, 'metrics');
    return this.getRecord('VM_metrics', metricsRef);
  }

  async updateVMConfig(ref, { nameLabel, nameDescription = '', vcpus, memoryStaticMax, tags = [] }) {
    await this.setField('VM', ref, 'name_label', nameLabel);
    await this.setField('VM', ref, 'name_description', nameDescription);
    await this.setField('VM', ref, 'VCPUs_max', String(vcpus));
    await this.setField('VM', ref, 'VCPUs_at_startup', String(vcpus));
    await this.setField('VM', ref, 'memory_static_max', String(memoryStaticMax));
    await this.setField('VM', ref, 'memory_dynamic_max', String(memoryStaticMax));
    await this.setField('VM', ref, 'tags', tags);
    return this.getRecord('VM', ref);
  }

  async addVMDisk(ref, { srRef, nameLabel, sizeBytes }) {
    const vm = await this.getRecord('VM', ref);
    const userdevice = String(Array.isArray(vm.VBDs) ? vm.VBDs.length : 0);

    const vdiRef = await this.create('VDI', {
      name_label: nameLabel,
      name_description: '',
      SR: srRef,
      virtual_size: String(sizeBytes),
      type: 'user',
      sharable: false,
      read_only: false,
      other_config: {},
      xenstore_data: {},
      sm_config: {},
      tags: [],
    });

    const vbdRef = await this.create('VBD', {
      VM: ref,
      VDI: vdiRef,
      userdevice,
      bootable: false,
      mode: 'RW',
      type: 'Disk',
      unpluggable: true,
      empty: false,
      other_config: {},
      qos_algorithm_type: '',
      qos_algorithm_params: {},
    });

    try {
      await this.call('VBD', 'plug', [vbdRef]);
    } catch (error) {
      // Plugging may fail if the guest is halted or the platform defers activation until next boot.
    }

    return { success: true, vdiRef, vbdRef };
  }

  async addVMNic(ref, { networkRef, deviceLabel = '', mac = '' }) {
    const vm = await this.getRecord('VM', ref);
    const device = deviceLabel || String(Array.isArray(vm.VIFs) ? vm.VIFs.length : 0);

    const vifRef = await this.create('VIF', {
      device: String(device),
      network: networkRef,
      VM: ref,
      MAC: mac,
      MTU: '1500',
      other_config: {},
      qos_algorithm_type: '',
      qos_algorithm_params: {},
      locking_mode: 'network_default',
    });

    try {
      await this.call('VIF', 'plug', [vifRef]);
    } catch (error) {
      // Some guests require activation on the next boot or only support plugging while running.
    }

    return { success: true, vifRef };
  }

  async getVMSnapshots(ref) {
    let snapshotRefs = [];

    try {
      const fieldRefs = await this.getField('VM', ref, 'snapshots');
      if (Array.isArray(fieldRefs)) {
        snapshotRefs = fieldRefs.filter(Boolean);
      }
    } catch (error) {
      // Some Xen builds do not surface snapshot refs directly; fall back to record scanning below.
    }

    if (!snapshotRefs.length) {
      const result = await this.getVMs();
      snapshotRefs = Object.entries(result.records || {})
        .filter(([, record]) => record?.snapshot_of === ref || record?.parent === ref)
        .map(([snapshotRef]) => snapshotRef);
    }

    const snapshots = await Promise.all(
      snapshotRefs.map(async (snapshotRef) => {
        const record = await this.getRecord('VM', snapshotRef);
        return { ref: snapshotRef, ...record };
      })
    );

    return snapshots.sort((left, right) =>
      new Date(right.snapshot_time || right.snapshotTime || 0) - new Date(left.snapshot_time || left.snapshotTime || 0)
    );
  }

  async createVMSnapshot(ref, { nameLabel, nameDescription = '', mode = 'snapshot' }) {
    const snapshotMethod = mode === 'checkpoint' ? 'checkpoint' : 'snapshot';
    const snapshotRef = await this.call('VM', snapshotMethod, [ref, nameLabel]);

    if (nameDescription) {
      try {
        await this.setField('VM', snapshotRef, 'name_description', nameDescription);
      } catch (error) {
        // Description support varies across snapshot implementations; snapshot creation already succeeded.
      }
    }

    const record = await this.getRecord('VM', snapshotRef);
    return {
      ref: snapshotRef,
      snapshot_mode: snapshotMethod,
      ...record,
    };
  }

  async revertVMSnapshot(snapshotRef) {
    return this.call('VM', 'revert', [snapshotRef]);
  }

  async deleteVMSnapshot(snapshotRef) {
    return this.destroy('VM', snapshotRef);
  }

  async getHostMetrics(ref) {
    const metricsRef = await this.getField('host', ref, 'metrics');
    return this.getRecord('host_metrics', metricsRef);
  }

  // Dashboard summary
  async getDashboardSummary() {
    const [pools, hosts, vms, srs, networks] = await Promise.all([
      this.getAllRecords('pool'),
      this.getAllRecords('host'),
      this.getAllRecords('VM'),
      this.getAllRecords('SR'),
      this.getAllRecords('network'),
    ]);

    const vmStates = { running: 0, halted: 0, suspended: 0, paused: 0, other: 0 };
    for (const [, vm] of Object.entries(vms)) {
      if (vm.is_a_template) continue;
      const state = vm.power_state || 'other';
      if (vmStates[state] !== undefined) vmStates[state]++;
      else vmStates.other++;
    }

    const hostStates = { enabled: 0, disabled: 0, offline: 0 };
    for (const [, host] of Object.entries(hosts)) {
      const live = host.enabled;
      if (live) hostStates.enabled++;
      else hostStates.disabled++;
    }

    return {
      poolCount: Object.keys(pools).length,
      hostCount: Object.keys(hosts).length,
      vmCount: Object.values(vms).filter(v => !v.is_a_template).length,
      templateCount: Object.values(vms).filter(v => v.is_a_template).length,
      srCount: Object.keys(srs).length,
      networkCount: Object.keys(networks).length,
      vmStates,
      hostStates,
      pools: Object.entries(pools).map(([ref, r]) => ({ ref, ...r })),
      hosts: Object.entries(hosts).map(([ref, r]) => ({ ref, name: r.name_label, ...r })),
    };
  }

  // Messages/alerts
  async getMessages() {
    return this.getAllRecords('message');
  }

  async getTasks() {
    return this.getAllRecords('task');
  }
}

// Connection manager - holds live Xen sessions per control-plane session
const connections = new Map();

function normalizeTargetKey(value) {
  return String(value || '').trim();
}

function buildConnectionTargetKey({ connectionId = null, host = '', username = '', port = 443 } = {}) {
  const normalizedConnectionId = Number(connectionId || 0);
  if (normalizedConnectionId > 0) {
    return `connection:${normalizedConnectionId}`;
  }

  const normalizedHost = String(host || '').trim().toLowerCase();
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedPort = Number(port || 443) || 443;
  return `host:${normalizedHost}|user:${normalizedUsername}|port:${normalizedPort}`;
}

function getConnectionRegistry(sessionId, create = false) {
  if (!sessionId) return null;

  let registry = connections.get(sessionId);
  if (!registry && create) {
    registry = new Map();
    connections.set(sessionId, registry);
  }
  return registry;
}

function getConnection(sessionId, targetKey = '') {
  const registry = getConnectionRegistry(sessionId);
  if (!registry) return null;

  const normalizedTargetKey = normalizeTargetKey(targetKey);
  if (normalizedTargetKey) {
    return registry.get(normalizedTargetKey) || null;
  }

  return registry.values().next().value || null;
}

function listConnections(sessionId) {
  const registry = getConnectionRegistry(sessionId);
  if (!registry) return [];

  return Array.from(registry.entries()).map(([targetKey, api]) => ({ targetKey, api }));
}

function listAllConnections() {
  return Array.from(connections.entries()).flatMap(([sessionId, registry]) =>
    Array.from(registry.entries()).map(([targetKey, api]) => ({
      sessionId,
      targetKey,
      api,
    }))
  );
}

function rehydrateConnection(sessionId, descriptorOrHost, sessionRef, targetKey = '') {
  const descriptor = typeof descriptorOrHost === 'object' && descriptorOrHost
    ? descriptorOrHost
    : {
        host: descriptorOrHost,
        sessionRef,
        targetKey,
      };
  if (!sessionId || !descriptor?.host || !descriptor?.sessionRef) return null;

  const resolvedTargetKey = normalizeTargetKey(descriptor.targetKey)
    || buildConnectionTargetKey(descriptor);
  const existing = getConnection(sessionId, resolvedTargetKey);
  if (existing) {
    existing.sessionRef = descriptor.sessionRef;
    return existing;
  }

  const api = new XenAPI(descriptor.host);
  api.sessionRef = descriptor.sessionRef;
  setConnection(sessionId, resolvedTargetKey, api);
  return api;
}

function rehydrateConnections(sessionId, descriptors = []) {
  return (Array.isArray(descriptors) ? descriptors : [])
    .map((descriptor) => rehydrateConnection(sessionId, descriptor))
    .filter(Boolean);
}

function setConnection(sessionId, targetKeyOrApi, maybeApi = null) {
  const registry = getConnectionRegistry(sessionId, true);
  const api = maybeApi || targetKeyOrApi;
  const targetKey = normalizeTargetKey(maybeApi ? targetKeyOrApi : '')
    || buildConnectionTargetKey({ host: api?.host || '', username: '', port: 443 });

  registry.set(targetKey, api);
  return api;
}

function clearConnections() {
  for (const registry of connections.values()) {
    for (const api of registry.values()) {
      api.logout?.().catch?.(() => {});
    }
  }
  connections.clear();
}

function removeConnection(sessionId, targetKey = '') {
  const registry = getConnectionRegistry(sessionId);
  if (!registry) return;

  const normalizedTargetKey = normalizeTargetKey(targetKey);
  if (!normalizedTargetKey) {
    for (const api of registry.values()) {
      api.logout?.().catch?.(() => {});
    }
    connections.delete(sessionId);
    return;
  }

  const api = registry.get(normalizedTargetKey);
  if (api) {
    api.logout?.().catch?.(() => {});
    registry.delete(normalizedTargetKey);
  }

  if (!registry.size) {
    connections.delete(sessionId);
  }
}

module.exports = {
  XenAPI,
  buildConnectionTargetKey,
  getConnection,
  listAllConnections,
  listConnections,
  rehydrateConnection,
  rehydrateConnections,
  setConnection,
  clearConnections,
  removeConnection,
};
