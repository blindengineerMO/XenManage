const axios = require('axios');
const config = require('../config');

let rpcId = 0;

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

  async getVMs() {
    return this.getClassRecords('VM');
  }

  async getSRs() {
    return this.getClassRecords('SR');
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

// Connection manager - holds active sessions per user
const connections = new Map();

function getConnection(sessionId) {
  return connections.get(sessionId);
}

function setConnection(sessionId, api) {
  connections.set(sessionId, api);
}

function removeConnection(sessionId) {
  const api = connections.get(sessionId);
  if (api) {
    api.logout().catch(() => {});
    connections.delete(sessionId);
  }
}

module.exports = { XenAPI, getConnection, setConnection, removeConnection };
