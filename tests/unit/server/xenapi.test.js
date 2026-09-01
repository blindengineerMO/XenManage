const { XenAPI } = require('../../../server/services/xenapi');

// Mock axios
jest.mock('axios');

describe('XenAPI', () => {
  let xenApi;
  let mockPost;
  let mockRequest;

  beforeEach(() => {
    const axios = require('axios');
    mockPost = jest.fn();
    mockRequest = jest.fn();
    axios.create = jest.fn(() => ({
      post: mockPost,
      request: mockRequest,
    }));
    xenApi = new XenAPI('192.168.1.100');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set host and base URL', () => {
      expect(xenApi.host).toBe('192.168.1.100');
      expect(xenApi.baseUrl).toBe('https://192.168.1.100/jsonrpc');
    });

    it('should start with no session', () => {
      expect(xenApi.sessionRef).toBeNull();
    });
  });

  describe('rpc', () => {
    it('should send JSON-RPC v2.0 request', async () => {
      mockPost.mockResolvedValue({ data: { jsonrpc: '2.0', result: 'OpaqueRef:test', id: 1 } });
      const result = await xenApi.rpc('session.login_with_password', ['root', 'pass', '2.0', 'xenmange']);
      expect(mockPost).toHaveBeenCalledWith(
        'https://192.168.1.100/jsonrpc',
        expect.objectContaining({
          jsonrpc: '2.0',
          method: 'session.login_with_password',
          params: ['root', 'pass', '2.0', 'xenmange'],
        })
      );
      expect(result).toBe('OpaqueRef:test');
    });

    it('should throw on error response', async () => {
      mockPost.mockResolvedValue({
        data: { jsonrpc: '2.0', error: { code: 1, message: 'SESSION_AUTHENTICATION_FAILED', data: [] }, id: 1 },
      });
      await expect(xenApi.rpc('test', [])).rejects.toThrow('SESSION_AUTHENTICATION_FAILED');
    });
  });

  describe('login', () => {
    it('should store session ref on success', async () => {
      mockPost.mockResolvedValue({ data: { jsonrpc: '2.0', result: 'OpaqueRef:session123', id: 1 } });
      const sessionRef = await xenApi.login('root', 'password');
      expect(sessionRef).toBe('OpaqueRef:session123');
      expect(xenApi.sessionRef).toBe('OpaqueRef:session123');
    });
  });

  describe('logout', () => {
    it('should call session.logout and clear ref', async () => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      mockPost.mockResolvedValue({ data: { jsonrpc: '2.0', result: '', id: 1 } });
      await xenApi.logout();
      expect(xenApi.sessionRef).toBeNull();
    });

    it('should handle already null session', async () => {
      xenApi.sessionRef = null;
      await xenApi.logout();
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('call', () => {
    it('should prepend session ref to params', async () => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      mockPost.mockResolvedValue({ data: { jsonrpc: '2.0', result: ['OpaqueRef:vm1'], id: 1 } });
      await xenApi.call('VM', 'get_all');
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'VM.get_all',
          params: ['OpaqueRef:session123'],
        })
      );
    });

    it('should throw if not authenticated', async () => {
      xenApi.sessionRef = null;
      await expect(xenApi.call('VM', 'get_all')).rejects.toThrow('NOT_AUTHENTICATED');
    });
  });

  describe('VM lifecycle methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      mockPost.mockResolvedValue({ data: { jsonrpc: '2.0', result: '', id: 1 } });
    });

    it('startVM should call VM.start', async () => {
      await xenApi.startVM('OpaqueRef:vm1', false, false);
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'VM.start',
          params: ['OpaqueRef:session123', 'OpaqueRef:vm1', false, false],
        })
      );
    });

    it('shutdownVM should call clean_shutdown by default', async () => {
      await xenApi.shutdownVM('OpaqueRef:vm1', false);
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'VM.clean_shutdown' })
      );
    });

    it('shutdownVM should call hard_shutdown when forced', async () => {
      await xenApi.shutdownVM('OpaqueRef:vm1', true);
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'VM.hard_shutdown' })
      );
    });

    it('rebootVM should call clean_reboot by default', async () => {
      await xenApi.rebootVM('OpaqueRef:vm1', false);
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'VM.clean_reboot' })
      );
    });

    it('createVMSnapshot should call VM.snapshot and return the created record', async () => {
      mockPost
        .mockResolvedValueOnce({ data: { jsonrpc: '2.0', result: 'OpaqueRef:snap1', id: 1 } })
        .mockResolvedValueOnce({ data: { jsonrpc: '2.0', result: '', id: 2 } })
        .mockResolvedValueOnce({ data: { jsonrpc: '2.0', result: { name_label: 'pre-maintenance', snapshot_time: '2026-08-24T12:00:00.000Z' }, id: 3 } });

      const result = await xenApi.createVMSnapshot('OpaqueRef:vm1', {
        nameLabel: 'pre-maintenance',
        nameDescription: 'Created before the Monday, August 24, 2026 maintenance window.',
        mode: 'snapshot',
      });

      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          method: 'VM.snapshot',
          params: ['OpaqueRef:session123', 'OpaqueRef:vm1', 'pre-maintenance'],
        })
      );
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:snap1',
        name_label: 'pre-maintenance',
        snapshot_mode: 'snapshot',
      }));
    });

    it('revertVMSnapshot should call VM.revert', async () => {
      await xenApi.revertVMSnapshot('OpaqueRef:snap1');
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'VM.revert' })
      );
    });

    it('deleteVMSnapshot should call VM.destroy', async () => {
      await xenApi.deleteVMSnapshot('OpaqueRef:snap1');
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'VM.destroy' })
      );
    });

    it('duplicateVM should use VM.clone for fast clones and optionally start the result', async () => {
      jest.spyOn(xenApi, 'cloneVM').mockResolvedValue('OpaqueRef:vm11');
      jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const startSpy = jest.spyOn(xenApi, 'startVM').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'app-01-clone',
        power_state: 'Running',
      });

      const result = await xenApi.duplicateVM('OpaqueRef:vm1', {
        nameLabel: 'app-01-clone',
        nameDescription: 'Fast clone created on Monday, August 24, 2026.',
        mode: 'clone',
        startAfter: true,
      });

      expect(xenApi.cloneVM).toHaveBeenCalledWith('OpaqueRef:vm1', 'app-01-clone');
      expect(startSpy).toHaveBeenCalledWith('OpaqueRef:vm11', false, false);
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vm11',
        duplication_mode: 'clone',
      }));
    });

    it('duplicateVM should use VM.copy for full copies', async () => {
      jest.spyOn(xenApi, 'copyVM').mockResolvedValue('OpaqueRef:vm12');
      jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'app-01-copy',
        power_state: 'Halted',
      });

      const result = await xenApi.duplicateVM('OpaqueRef:vm1', {
        nameLabel: 'app-01-copy',
        nameDescription: 'Full copy created on Monday, August 24, 2026.',
        mode: 'copy',
        srRef: 'OpaqueRef:sr1',
        startAfter: false,
      });

      expect(xenApi.copyVM).toHaveBeenCalledWith('OpaqueRef:vm1', 'app-01-copy', 'OpaqueRef:sr1');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vm12',
        duplication_mode: 'copy',
        targetSrRef: 'OpaqueRef:sr1',
      }));
    });

    it('migrateVM should call VM.pool_migrate and optionally update home server affinity', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          name_label: 'app-01',
          power_state: 'Running',
          resident_on: 'OpaqueRef:host1',
        })
        .mockResolvedValueOnce({
          name_label: 'app-01',
          power_state: 'Running',
          resident_on: 'OpaqueRef:host2',
          affinity: 'OpaqueRef:host2',
        });

      const result = await xenApi.migrateVM('OpaqueRef:vm1', {
        hostRef: 'OpaqueRef:host2',
        live: true,
        force: false,
        compress: true,
        setAsHomeServer: true,
      });

      expect(callSpy).toHaveBeenCalledWith('VM', 'pool_migrate', ['OpaqueRef:vm1', 'OpaqueRef:host2', {
        force: 'false',
        live: 'true',
        copy: 'false',
        compress: 'true',
      }]);
      expect(setFieldSpy).toHaveBeenCalledWith('VM', 'OpaqueRef:vm1', 'affinity', 'OpaqueRef:host2');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vm1',
        migration_mode: 'live',
        migrated_to: 'OpaqueRef:host2',
        homeServerUpdated: true,
      }));
    });

    it('migrateVM should downgrade to relocate mode for halted workloads', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          name_label: 'app-01',
          power_state: 'Halted',
          resident_on: 'OpaqueRef:host1',
        })
        .mockResolvedValueOnce({
          name_label: 'app-01',
          power_state: 'Halted',
          resident_on: 'OpaqueRef:host2',
        });

      const result = await xenApi.migrateVM('OpaqueRef:vm1', {
        hostRef: 'OpaqueRef:host2',
        live: true,
        force: true,
        compress: true,
      });

      expect(callSpy).toHaveBeenCalledWith('VM', 'pool_migrate', ['OpaqueRef:vm1', 'OpaqueRef:host2', {
        force: 'true',
        live: 'false',
        copy: 'false',
        compress: 'false',
      }]);
      expect(result).toEqual(expect.objectContaining({
        migration_mode: 'relocate',
        migrated_to: 'OpaqueRef:host2',
      }));
    });

    it('migrateReceive should call host.migrate_receive with the destination coordinator and network', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue({ token: 'dest-map' });
      const result = await xenApi.migrateReceive('OpaqueRef:host9', 'OpaqueRef:net9', { tunnel: 'true' });

      expect(callSpy).toHaveBeenCalledWith('host', 'migrate_receive', ['OpaqueRef:host9', 'OpaqueRef:net9', { tunnel: 'true' }]);
      expect(result).toEqual({ token: 'dest-map' });
    });

    it('migrateSend should call VM.migrate_send with VDI and VIF maps', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue('OpaqueRef:vm99');
      const result = await xenApi.migrateSend('OpaqueRef:vm1', { token: 'dest-map' }, {
        live: true,
        vdiMap: { 'OpaqueRef:vdi1': 'OpaqueRef:sr2' },
        vifMap: { 'OpaqueRef:vif1': 'OpaqueRef:net2' },
        options: {},
      });

      expect(callSpy).toHaveBeenCalledWith('VM', 'migrate_send', [
        'OpaqueRef:vm1',
        { token: 'dest-map' },
        true,
        { 'OpaqueRef:vdi1': 'OpaqueRef:sr2' },
        { 'OpaqueRef:vif1': 'OpaqueRef:net2' },
        {},
        {},
      ]);
      expect(result).toBe('OpaqueRef:vm99');
    });

    it('migrateVMToTarget should orchestrate destination receive, validation, and send steps', async () => {
      const destinationApi = {
        getPools: jest.fn().mockResolvedValue({
          refs: ['OpaqueRef:pool2'],
          records: {
            'OpaqueRef:pool2': {
              master: 'OpaqueRef:host9',
              default_SR: 'OpaqueRef:sr2',
              migration_network: 'OpaqueRef:net2',
            },
          },
        }),
        getHosts: jest.fn().mockResolvedValue({ refs: ['OpaqueRef:host9'], records: { 'OpaqueRef:host9': { name_label: 'dest-host' } } }),
        migrateReceive: jest.fn().mockResolvedValue({ token: 'dest-map' }),
        getRecord: jest.fn().mockResolvedValue({
          name_label: 'app-01',
          uuid: 'vm-uuid-1',
          power_state: 'Running',
          resident_on: 'OpaqueRef:host9',
        }),
        getVMs: jest.fn().mockResolvedValue({
          records: {
            'OpaqueRef:vm99': {
              name_label: 'app-01',
              uuid: 'vm-uuid-1',
              power_state: 'Running',
              resident_on: 'OpaqueRef:host9',
            },
          },
        }),
      };

      jest.spyOn(xenApi, 'getRecord')
        .mockImplementation(async (className, ref) => {
          if (className === 'VM' && ref === 'OpaqueRef:vm1') {
            return {
              name_label: 'app-01',
              uuid: 'vm-uuid-1',
              power_state: 'Running',
              VIFs: ['OpaqueRef:vif1'],
              VBDs: ['OpaqueRef:vbd1'],
            };
          }
          if (className === 'VBD' && ref === 'OpaqueRef:vbd1') {
            return {
              VDI: 'OpaqueRef:vdi1',
              type: 'Disk',
              empty: false,
            };
          }
          throw new Error(`Unexpected getRecord lookup: ${className} ${ref}`);
        });
      const assertSpy = jest.spyOn(xenApi, 'assertCanMigrate').mockResolvedValue(undefined);
      const sendSpy = jest.spyOn(xenApi, 'migrateSend').mockResolvedValue('OpaqueRef:vm99');

      const result = await xenApi.migrateVMToTarget('OpaqueRef:vm1', destinationApi, {
        destinationTargetKey: 'connection:2',
        transferNetworkRef: 'OpaqueRef:net2',
        srRef: 'OpaqueRef:sr2',
        vifNetworkMap: [{ vifRef: 'OpaqueRef:vif1', networkRef: 'OpaqueRef:net2' }],
        live: true,
      });

      expect(destinationApi.migrateReceive).toHaveBeenCalledWith('OpaqueRef:host9', 'OpaqueRef:net2', {});
      expect(assertSpy).toHaveBeenCalledWith('OpaqueRef:vm1', { token: 'dest-map' }, expect.objectContaining({
        live: true,
        vdiMap: { 'OpaqueRef:vdi1': 'OpaqueRef:sr2' },
        vifMap: { 'OpaqueRef:vif1': 'OpaqueRef:net2' },
      }));
      expect(sendSpy).toHaveBeenCalledWith('OpaqueRef:vm1', { token: 'dest-map' }, expect.objectContaining({
        live: true,
        vdiMap: { 'OpaqueRef:vdi1': 'OpaqueRef:sr2' },
        vifMap: { 'OpaqueRef:vif1': 'OpaqueRef:net2' },
      }));
      expect(result).toEqual(expect.objectContaining({
        migration_mode: 'cross-pool-live',
        destinationTargetKey: 'connection:2',
        destinationVmRef: 'OpaqueRef:vm99',
        targetSrRef: 'OpaqueRef:sr2',
      }));
    });

    it('buildConsoleLocationUrl should normalize relative console paths and append the active session', () => {
      xenApi.sessionRef = 'OpaqueRef:session123';

      const result = xenApi.buildConsoleLocationUrl('/console?ref=OpaqueRef:vm1');

      expect(result.toString()).toBe('https://192.168.1.100/console?ref=OpaqueRef%3Avm1&session_id=OpaqueRef%3Asession123');
    });

    it('getVMConsoles should resolve console records for a VM', async () => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(['OpaqueRef:console1']);
      jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        VM: 'OpaqueRef:vm1',
        protocol: 'rfb',
        location: '/console?ref=OpaqueRef:vm1',
        uuid: 'console-uuid-1',
      });

      const result = await xenApi.getVMConsoles('OpaqueRef:vm1');

      expect(callSpy).toHaveBeenCalledWith('VM', 'get_consoles', ['OpaqueRef:vm1']);
      expect(result).toEqual([
        expect.objectContaining({
          ref: 'OpaqueRef:console1',
          protocol: 'rfb',
          absoluteLocation: 'https://192.168.1.100/console?ref=OpaqueRef%3Avm1&session_id=OpaqueRef%3Asession123',
        }),
      ]);
    });

    it('getVMCompatibility should combine possible-host checks with per-host boot assertions', async () => {
      jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        ref: 'OpaqueRef:vm1',
        uuid: 'vm-uuid-1',
        name_label: 'app-01',
        power_state: 'Running',
        resident_on: 'OpaqueRef:host1',
        affinity: 'OpaqueRef:host1',
        hardware_platform_version: 3,
        last_boot_CPU_flags: { aes: 'true', avx: 'true' },
      });
      jest.spyOn(xenApi, 'getHosts').mockResolvedValue({
        refs: ['OpaqueRef:host1', 'OpaqueRef:host2'],
        records: {
          'OpaqueRef:host1': {
            name_label: 'alpha-xen',
            enabled: true,
            maintenance_mode: false,
            cpu_info: { modelname: 'AMD EPYC 7543P', cpu_count: '32', socket_count: '2' },
          },
          'OpaqueRef:host2': {
            name_label: 'beta-xen',
            enabled: false,
            maintenance_mode: false,
            cpu_info: { modelname: 'AMD EPYC 7543P', cpu_count: '32', socket_count: '2' },
          },
        },
      });
      jest.spyOn(xenApi, 'call')
        .mockResolvedValueOnce(['OpaqueRef:host1', 'OpaqueRef:host2']);
      const assertSpy = jest.spyOn(xenApi, 'assertCanBootHere')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(Object.assign(new Error('HOST_DISABLED'), { code: 'HOST_DISABLED' }));

      const result = await xenApi.getVMCompatibility('OpaqueRef:vm1');

      expect(assertSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vm1',
        hardwarePlatformVersion: 3,
        maskingApiAvailable: false,
      }));
      expect(result.hosts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          ref: 'OpaqueRef:host1',
          compatible: true,
          readiness: 'compatible',
        }),
        expect.objectContaining({
          ref: 'OpaqueRef:host2',
          compatible: false,
          readiness: 'maintenance',
          compatibilityError: 'HOST_DISABLED',
        }),
      ]));
    });

    it('updateVMConfig should persist identity, CPU sizing, the full memory envelope, advanced metadata, and placement links before returning the refreshed record', async () => {
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          VCPUs_at_startup: '2',
          VCPUs_max: '2',
        })
        .mockResolvedValueOnce({
        name_label: 'app-01-renamed',
        name_description: 'Updated operator-facing VM description.',
        user_version: 8,
        start_delay: 45,
        shutdown_delay: 90,
        order: 3,
        VCPUs_at_startup: '4',
        VCPUs_max: '6',
        memory_static_min: '4294967296',
        memory_dynamic_min: '6442450944',
        memory_static_max: '8589934592',
        memory_dynamic_max: '7516192768',
        hardware_platform_version: 4,
        domain_type: 'pvh',
        has_vendor_device: false,
        affinity: 'OpaqueRef:host2',
        appliance: 'OpaqueRef:appliance2',
        snapshot_schedule: 'OpaqueRef:vmss2',
        tags: ['prod', 'linux', 'tier-1'],
        blocked_operations: {
          start: 'OPERATION_NOT_ALLOWED',
          pool_migrate: 'OPERATION_NOT_ALLOWED',
        },
        VCPUs_params: {
          weight: '512',
          cap: '75',
        },
        other_config: {
          owner: 'storage-team',
          patchWindow: 'sun-0200',
        },
        xenstore_data: {
          'vm-data/cloud-init': 'enabled',
          'guest/channel': 'ops',
        },
        NVRAM: {
          'EFI/BootOrder': '0003,0004',
          'EFI/SecureBootMode': 'user',
        },
        platform: {
          secureboot: 'disabled',
          firmware: 'bios',
        },
      });

      const result = await xenApi.updateVMConfig('OpaqueRef:vm1', {
        nameLabel: 'app-01-renamed',
        nameDescription: 'Updated operator-facing VM description.',
        userVersion: 8,
        startDelay: 45,
        shutdownDelay: 90,
        order: 3,
        vcpusAtStartup: 4,
        vcpusMax: 6,
        memoryStaticMin: 4294967296,
        memoryDynamicMin: 6442450944,
        memoryDynamicMax: 7516192768,
        memoryStaticMax: 8589934592,
        hardwarePlatformVersion: 4,
        domainType: 'pvh',
        hasVendorDevice: false,
        affinity: 'OpaqueRef:host2',
        applianceRef: 'OpaqueRef:appliance2',
        snapshotScheduleRef: 'OpaqueRef:vmss2',
        tags: ['prod', 'linux', 'tier-1'],
        blockedOperations: {
          start: 'OPERATION_NOT_ALLOWED',
          pool_migrate: 'OPERATION_NOT_ALLOWED',
        },
        vcpusParams: {
          weight: '512',
          cap: '75',
        },
        otherConfig: {
          owner: 'storage-team',
          patchWindow: 'sun-0200',
        },
        xenstoreData: {
          'vm-data/cloud-init': 'enabled',
          'guest/channel': 'ops',
        },
        nvram: {
          'EFI/BootOrder': '0003,0004',
          'EFI/SecureBootMode': 'user',
        },
        platform: {
          secureboot: 'disabled',
          firmware: 'bios',
        },
      });

      expect(setFieldSpy).toHaveBeenNthCalledWith(1, 'VM', 'OpaqueRef:vm1', 'name_label', 'app-01-renamed');
      expect(setFieldSpy).toHaveBeenNthCalledWith(2, 'VM', 'OpaqueRef:vm1', 'name_description', 'Updated operator-facing VM description.');
      expect(setFieldSpy).toHaveBeenNthCalledWith(3, 'VM', 'OpaqueRef:vm1', 'user_version', 8);
      expect(setFieldSpy).toHaveBeenNthCalledWith(4, 'VM', 'OpaqueRef:vm1', 'start_delay', 45);
      expect(setFieldSpy).toHaveBeenNthCalledWith(5, 'VM', 'OpaqueRef:vm1', 'shutdown_delay', 90);
      expect(setFieldSpy).toHaveBeenNthCalledWith(6, 'VM', 'OpaqueRef:vm1', 'order', 3);
      expect(setFieldSpy).toHaveBeenNthCalledWith(7, 'VM', 'OpaqueRef:vm1', 'VCPUs_max', '6');
      expect(setFieldSpy).toHaveBeenNthCalledWith(8, 'VM', 'OpaqueRef:vm1', 'VCPUs_at_startup', '4');
      expect(callSpy).toHaveBeenNthCalledWith(1, 'VM', 'set_memory_limits', [
        'OpaqueRef:vm1',
        4294967296,
        8589934592,
        6442450944,
        7516192768,
      ]);
      expect(setFieldSpy).toHaveBeenNthCalledWith(9, 'VM', 'OpaqueRef:vm1', 'hardware_platform_version', 4);
      expect(setFieldSpy).toHaveBeenNthCalledWith(10, 'VM', 'OpaqueRef:vm1', 'domain_type', 'pvh');
      expect(setFieldSpy).toHaveBeenNthCalledWith(11, 'VM', 'OpaqueRef:vm1', 'has_vendor_device', false);
      expect(setFieldSpy).toHaveBeenNthCalledWith(12, 'VM', 'OpaqueRef:vm1', 'affinity', 'OpaqueRef:host2');
      expect(setFieldSpy).toHaveBeenNthCalledWith(13, 'VM', 'OpaqueRef:vm1', 'appliance', 'OpaqueRef:appliance2');
      expect(setFieldSpy).toHaveBeenNthCalledWith(14, 'VM', 'OpaqueRef:vm1', 'snapshot_schedule', 'OpaqueRef:vmss2');
      expect(setFieldSpy).toHaveBeenNthCalledWith(15, 'VM', 'OpaqueRef:vm1', 'tags', ['prod', 'linux', 'tier-1']);
      expect(setFieldSpy).toHaveBeenNthCalledWith(16, 'VM', 'OpaqueRef:vm1', 'blocked_operations', {
        start: 'OPERATION_NOT_ALLOWED',
        pool_migrate: 'OPERATION_NOT_ALLOWED',
      });
      expect(setFieldSpy).toHaveBeenNthCalledWith(17, 'VM', 'OpaqueRef:vm1', 'VCPUs_params', {
        weight: '512',
        cap: '75',
      });
      expect(setFieldSpy).toHaveBeenNthCalledWith(18, 'VM', 'OpaqueRef:vm1', 'other_config', {
        owner: 'storage-team',
        patchWindow: 'sun-0200',
      });
      expect(setFieldSpy).toHaveBeenNthCalledWith(19, 'VM', 'OpaqueRef:vm1', 'xenstore_data', {
        'vm-data/cloud-init': 'enabled',
        'guest/channel': 'ops',
      });
      expect(setFieldSpy).toHaveBeenNthCalledWith(20, 'VM', 'OpaqueRef:vm1', 'NVRAM', {
        'EFI/BootOrder': '0003,0004',
        'EFI/SecureBootMode': 'user',
      });
      expect(setFieldSpy).toHaveBeenNthCalledWith(21, 'VM', 'OpaqueRef:vm1', 'platform', {
        secureboot: 'disabled',
        firmware: 'bios',
      });
      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'VM', 'OpaqueRef:vm1');
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'VM', 'OpaqueRef:vm1');
      expect(result).toEqual(expect.objectContaining({
        name_label: 'app-01-renamed',
        user_version: 8,
        start_delay: 45,
        shutdown_delay: 90,
        order: 3,
        VCPUs_at_startup: '4',
        VCPUs_max: '6',
        memory_static_min: '4294967296',
        memory_dynamic_min: '6442450944',
        memory_dynamic_max: '7516192768',
        hardware_platform_version: 4,
        domain_type: 'pvh',
        has_vendor_device: false,
        affinity: 'OpaqueRef:host2',
        appliance: 'OpaqueRef:appliance2',
        snapshot_schedule: 'OpaqueRef:vmss2',
        tags: ['prod', 'linux', 'tier-1'],
        blocked_operations: {
          start: 'OPERATION_NOT_ALLOWED',
          pool_migrate: 'OPERATION_NOT_ALLOWED',
        },
        VCPUs_params: {
          weight: '512',
          cap: '75',
        },
        other_config: {
          owner: 'storage-team',
          patchWindow: 'sun-0200',
        },
        xenstore_data: {
          'vm-data/cloud-init': 'enabled',
          'guest/channel': 'ops',
        },
        NVRAM: {
          'EFI/BootOrder': '0003,0004',
          'EFI/SecureBootMode': 'user',
        },
        platform: {
          secureboot: 'disabled',
          firmware: 'bios',
        },
      }));
    });

    it('updateVMConfig should reject startup vcpu counts above the halted maximum', async () => {
      await expect(
        xenApi.updateVMConfig('OpaqueRef:vm1', {
          nameLabel: 'app-01-invalid',
          vcpusAtStartup: 8,
          vcpusMax: 4,
          memoryStaticMin: 4294967296,
          memoryDynamicMin: 4294967296,
          memoryDynamicMax: 8589934592,
          memoryStaticMax: 8589934592,
        })
      ).rejects.toMatchObject({
        code: 'VM_VCPU_LIMITS_INVALID',
      });
    });

    it('exportVM should stream a full XVA package from the documented HTTP handler', async () => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      mockRequest.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
        data: 'stream-body',
      });

      const result = await xenApi.exportVM('OpaqueRef:vm1');

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        method: 'GET',
        url: 'https://192.168.1.100/export?session_id=OpaqueRef%3Asession123&ref=OpaqueRef%3Avm1',
        responseType: 'stream',
      }));
      expect(result.status).toBe(200);
    });

    it('exportVM should switch to metadata export when requested', async () => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      mockRequest.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
        data: 'stream-body',
      });

      await xenApi.exportVM('OpaqueRef:vm1', { metadataOnly: true });

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://192.168.1.100/export_metadata?session_id=OpaqueRef%3Asession123&ref=OpaqueRef%3Avm1',
      }));
    });

    it('importVM should stream a package to the XenServer import handler', async () => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      mockRequest.mockResolvedValue({
        status: 200,
        data: 'ok',
      });

      const payload = Buffer.from('demo-xva');
      const result = await xenApi.importVM(payload, {
        srRef: 'OpaqueRef:sr1',
        restore: true,
        force: true,
        contentLength: payload.length,
      });

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        method: 'PUT',
        url: 'https://192.168.1.100/import?session_id=OpaqueRef%3Asession123&sr_id=OpaqueRef%3Asr1&restore=true&force=true',
        data: payload,
        headers: expect.objectContaining({
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(payload.length),
        }),
      }));
      expect(result.status).toBe(200);
    });

    it('importVM should use the metadata import handler without SR placement', async () => {
      xenApi.sessionRef = 'OpaqueRef:session123';
      mockRequest.mockResolvedValue({
        status: 200,
        data: 'ok',
      });

      await xenApi.importVM(Buffer.from('metadata'), { metadataOnly: true });

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://192.168.1.100/import_metadata?session_id=OpaqueRef%3Asession123',
      }));
    });

    it('updateHostConfig should persist the host name, description, tags, guest VCPU params, scheduler granularity, and logging map before returning the refreshed record', async () => {
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'alpha-xen-west',
        name_description: 'Updated operator-facing description for the west production host.',
        tags: ['prod', 'west', 'governed'],
        guest_VCPUs_params: {
          weight: '384',
          cap: '0',
        },
        sched_gran: 'core',
        logging: {
          syslog_destination: '10.0.0.51',
          syslog_level: 'warning',
        },
        address: '10.0.0.11',
        uuid: 'host-uuid-1',
        enabled: true,
      });

      const result = await xenApi.updateHostConfig('OpaqueRef:host1', {
        nameLabel: 'alpha-xen-west',
        nameDescription: 'Updated operator-facing description for the west production host.',
        tags: ['prod', 'west', 'governed'],
        guestVcpusParams: {
          weight: '384',
          cap: '0',
        },
        schedGran: 'core',
        logging: {
          syslog_destination: '10.0.0.51',
          syslog_level: 'warning',
        },
      });

      expect(setFieldSpy).toHaveBeenNthCalledWith(1, 'host', 'OpaqueRef:host1', 'name_label', 'alpha-xen-west');
      expect(setFieldSpy).toHaveBeenNthCalledWith(2, 'host', 'OpaqueRef:host1', 'name_description', 'Updated operator-facing description for the west production host.');
      expect(setFieldSpy).toHaveBeenNthCalledWith(3, 'host', 'OpaqueRef:host1', 'tags', ['prod', 'west', 'governed']);
      expect(setFieldSpy).toHaveBeenNthCalledWith(4, 'host', 'OpaqueRef:host1', 'guest_VCPUs_params', {
        weight: '384',
        cap: '0',
      });
      expect(setFieldSpy).toHaveBeenNthCalledWith(5, 'host', 'OpaqueRef:host1', 'sched_gran', 'core');
      expect(setFieldSpy).toHaveBeenNthCalledWith(6, 'host', 'OpaqueRef:host1', 'logging', {
        syslog_destination: '10.0.0.51',
        syslog_level: 'warning',
      });
      expect(getRecordSpy).toHaveBeenCalledWith('host', 'OpaqueRef:host1');
      expect(result).toEqual(expect.objectContaining({
        name_label: 'alpha-xen-west',
        name_description: 'Updated operator-facing description for the west production host.',
        tags: ['prod', 'west', 'governed'],
        guest_VCPUs_params: {
          weight: '384',
          cap: '0',
        },
        sched_gran: 'core',
        logging: {
          syslog_destination: '10.0.0.51',
          syslog_level: 'warning',
        },
        uuid: 'host-uuid-1',
      }));
    });

    it('enterHostMaintenance should disable the host and evacuate workloads', async () => {
      const disableSpy = jest.spyOn(xenApi, 'disableHost').mockResolvedValue(undefined);
      const assertSpy = jest.spyOn(xenApi, 'assertCanEvacuateHost').mockResolvedValue(undefined);
      const evacuateSpy = jest.spyOn(xenApi, 'evacuateHost').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'alpha-xen',
        enabled: false,
      });

      const result = await xenApi.enterHostMaintenance('OpaqueRef:host1', {
        networkRef: 'OpaqueRef:net1',
        evacuateBatchSize: 2,
        evacuateRunningVms: true,
      });

      expect(disableSpy).toHaveBeenCalledWith('OpaqueRef:host1', false);
      expect(assertSpy).toHaveBeenCalledWith('OpaqueRef:host1');
      expect(evacuateSpy).toHaveBeenCalledWith('OpaqueRef:host1', 'OpaqueRef:net1', 2);
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:host1',
        maintenance_mode: true,
        maintenanceNetworkRef: 'OpaqueRef:net1',
      }));
    });

    it('enterHostMaintenance should re-enable the host if evacuation fails', async () => {
      jest.spyOn(xenApi, 'disableHost').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'assertCanEvacuateHost').mockRejectedValue(new Error('CANNOT_EVACUATE'));
      const enableSpy = jest.spyOn(xenApi, 'enableHost').mockResolvedValue(undefined);

      await expect(xenApi.enterHostMaintenance('OpaqueRef:host1', {
        networkRef: 'OpaqueRef:net1',
        evacuateRunningVms: true,
      })).rejects.toThrow('CANNOT_EVACUATE');

      expect(enableSpy).toHaveBeenCalledWith('OpaqueRef:host1');
    });

    it('exitHostMaintenance should re-enable the host and return the refreshed record', async () => {
      const enableSpy = jest.spyOn(xenApi, 'enableHost').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'alpha-xen',
        enabled: true,
      });

      const result = await xenApi.exitHostMaintenance('OpaqueRef:host1');

      expect(enableSpy).toHaveBeenCalledWith('OpaqueRef:host1');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:host1',
        maintenance_mode: false,
        enabled: true,
      }));
    });
  });

  describe('rrd update methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
    });

    it('getRrdUpdates should request the json rrd_updates endpoint', async () => {
      mockRequest.mockResolvedValue({
        status: 200,
        data: {
          meta: { start: 1724670000, end: 1724673600, step: 60 },
          data: [],
        },
      });

      const result = await xenApi.getRrdUpdates({
        start: 1724670000,
        cf: 'MAX',
        interval: 300,
        host: true,
      });

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        method: 'GET',
        responseType: 'json',
        url: expect.stringContaining('/rrd_updates?'),
      }));
      const url = String(mockRequest.mock.calls[0][0].url || '');
      expect(url).toContain('session_id=OpaqueRef%3Asession123');
      expect(url).toContain('start=1724670000');
      expect(url).toContain('cf=MAX');
      expect(url).toContain('interval=300');
      expect(url).toContain('host=true');
      expect(url).toContain('json=true');
      expect(result).toEqual(expect.objectContaining({
        meta: expect.objectContaining({ step: 60 }),
      }));
    });
  });

  describe('pool methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
    });

    it('updatePoolConfig should persist pool name, description, default SR, legacy vSwitch controller, migration compression, WLB enablement, IGMP snooping, tags, and other_config before returning the refreshed record', async () => {
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'Production Pool West',
        name_description: 'Updated operator-facing pool summary for the west cluster.',
        default_SR: 'OpaqueRef:sr2',
        vswitch_controller: '10.0.0.81',
        migration_compression: true,
        wlb_enabled: true,
        wlb_url: 'https://wlb-west.example.internal',
        IGMP_snooping_enabled: true,
        tags: ['prod', 'west', 'governed'],
        other_config: {
          owner: 'platform-ops',
          governance_tier: 'gold',
        },
        uuid: 'pool-uuid-1',
        master: 'OpaqueRef:host1',
      });

      const result = await xenApi.updatePoolConfig('OpaqueRef:pool1', {
        nameLabel: 'Production Pool West',
        nameDescription: 'Updated operator-facing pool summary for the west cluster.',
        defaultSrRef: 'OpaqueRef:sr2',
        vswitchController: '10.0.0.81',
        migrationCompressionEnabled: true,
        wlbEnabled: true,
        igmpSnoopingEnabled: true,
        tags: ['prod', 'west', 'governed'],
        otherConfig: {
          owner: 'platform-ops',
          governance_tier: 'gold',
        },
      });

      expect(setFieldSpy).toHaveBeenNthCalledWith(1, 'pool', 'OpaqueRef:pool1', 'name_label', 'Production Pool West');
      expect(setFieldSpy).toHaveBeenNthCalledWith(2, 'pool', 'OpaqueRef:pool1', 'name_description', 'Updated operator-facing pool summary for the west cluster.');
      expect(setFieldSpy).toHaveBeenNthCalledWith(3, 'pool', 'OpaqueRef:pool1', 'default_SR', 'OpaqueRef:sr2');
      expect(callSpy).toHaveBeenNthCalledWith(1, 'pool', 'set_vswitch_controller', ['10.0.0.81']);
      expect(setFieldSpy).toHaveBeenNthCalledWith(4, 'pool', 'OpaqueRef:pool1', 'IGMP_snooping_enabled', true);
      expect(setFieldSpy).toHaveBeenNthCalledWith(5, 'pool', 'OpaqueRef:pool1', 'migration_compression', true);
      expect(setFieldSpy).toHaveBeenNthCalledWith(6, 'pool', 'OpaqueRef:pool1', 'wlb_enabled', true);
      expect(setFieldSpy).toHaveBeenNthCalledWith(7, 'pool', 'OpaqueRef:pool1', 'tags', ['prod', 'west', 'governed']);
      expect(setFieldSpy).toHaveBeenNthCalledWith(8, 'pool', 'OpaqueRef:pool1', 'other_config', {
        owner: 'platform-ops',
        governance_tier: 'gold',
      });
      expect(getRecordSpy).toHaveBeenCalledWith('pool', 'OpaqueRef:pool1');
      expect(result).toEqual(expect.objectContaining({
        name_label: 'Production Pool West',
        name_description: 'Updated operator-facing pool summary for the west cluster.',
        default_SR: 'OpaqueRef:sr2',
        vswitch_controller: '10.0.0.81',
        migration_compression: true,
        wlb_enabled: true,
        wlb_url: 'https://wlb-west.example.internal',
        IGMP_snooping_enabled: true,
        tags: ['prod', 'west', 'governed'],
        other_config: {
          owner: 'platform-ops',
          governance_tier: 'gold',
        },
        uuid: 'pool-uuid-1',
      }));
    });

    it('updatePoolHaState should enable HA with the selected heartbeat SRs and return the refreshed record', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          ha_enabled: false,
          ha_configuration: {},
        })
        .mockResolvedValueOnce({
          name_label: 'Production Pool',
          ha_enabled: true,
          ha_host_failures_to_tolerate: 2,
          ha_plan_exists_for: 2,
          ha_overcommitted: false,
        });

      const result = await xenApi.updatePoolHaState('OpaqueRef:pool1', {
        enabled: true,
        heartbeatSrRefs: ['OpaqueRef:sr2'],
        haHostFailuresToTolerate: 2,
        configuration: {},
      });

      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'pool', 'OpaqueRef:pool1');
      expect(callSpy).toHaveBeenCalledWith('pool', 'enable_ha', [['OpaqueRef:sr2'], {}]);
      expect(setFieldSpy).toHaveBeenCalledWith('pool', 'OpaqueRef:pool1', 'ha_host_failures_to_tolerate', 2);
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'pool', 'OpaqueRef:pool1');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:pool1',
        requestedEnabled: true,
        requestedTolerance: 2,
        heartbeatSrRefs: ['OpaqueRef:sr2'],
        ha_enabled: true,
        ha_host_failures_to_tolerate: 2,
      }));
    });

    it('updatePoolHaState should disable HA and return the refreshed record', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          ha_enabled: true,
          ha_configuration: { tolerance: '1' },
        })
        .mockResolvedValueOnce({
          name_label: 'Production Pool',
          ha_enabled: false,
          ha_host_failures_to_tolerate: 0,
          ha_plan_exists_for: 0,
          ha_overcommitted: false,
        });

      const result = await xenApi.updatePoolHaState('OpaqueRef:pool1', {
        enabled: false,
      });

      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'pool', 'OpaqueRef:pool1');
      expect(callSpy).toHaveBeenCalledWith('pool', 'disable_ha', []);
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'pool', 'OpaqueRef:pool1');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:pool1',
        requestedEnabled: false,
        ha_enabled: false,
      }));
    });

    it('updatePoolHaState should adjust tolerance without re-enabling HA when already active', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          ha_enabled: true,
          ha_configuration: {},
          ha_host_failures_to_tolerate: 1,
        })
        .mockResolvedValueOnce({
          name_label: 'Production Pool',
          ha_enabled: true,
          ha_host_failures_to_tolerate: 2,
          ha_plan_exists_for: 2,
          ha_overcommitted: false,
        });

      const result = await xenApi.updatePoolHaState('OpaqueRef:pool1', {
        enabled: true,
        heartbeatSrRefs: [],
        haHostFailuresToTolerate: 2,
        configuration: {},
      });

      expect(callSpy).not.toHaveBeenCalledWith('pool', 'enable_ha', expect.anything());
      expect(setFieldSpy).toHaveBeenCalledWith('pool', 'OpaqueRef:pool1', 'ha_host_failures_to_tolerate', 2);
      expect(result).toEqual(expect.objectContaining({
        requestedEnabled: true,
        requestedTolerance: 2,
        ha_enabled: true,
        ha_host_failures_to_tolerate: 2,
      }));
    });
  });

  describe('storage methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
    });

    it('probeStorageRepository should prefer structured SR.probe_ext results when available', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValueOnce([
        {
          complete: true,
          configuration: {
            server: '10.42.0.25',
            serverpath: '/exports/xen/imported',
            blank: '   ',
          },
          extra_info: {
            discovery: 'existing-sr',
          },
          sr: {
            uuid: 'imported-nfs-uuid',
            name_label: 'Imported Archive SR',
            health: 'healthy',
            total_space: 21474836480,
            free_space: 8589934592,
            clustered: false,
          },
        },
      ]);

      const result = await xenApi.probeStorageRepository({
        hostRef: 'OpaqueRef:host1',
        type: 'nfs',
        deviceConfig: {
          server: '10.42.0.25',
          serverpath: '/exports/xen/imported',
          blank: '   ',
        },
        smConfig: {},
      });

      expect(callSpy).toHaveBeenCalledWith('SR', 'probe_ext', [
        'OpaqueRef:host1',
        {
          server: '10.42.0.25',
          serverpath: '/exports/xen/imported',
        },
        'nfs',
        {},
      ]);
      expect(result).toEqual(expect.objectContaining({
        mode: 'probe_ext',
        requestedConfiguration: {
          server: '10.42.0.25',
          serverpath: '/exports/xen/imported',
        },
        summary: expect.objectContaining({
          totalResults: 1,
          completeResults: 1,
          existingSrs: 1,
        }),
      }));
      expect(result.results[0]).toEqual(expect.objectContaining({
        complete: true,
        extraInfo: expect.objectContaining({
          discovery: 'existing-sr',
        }),
        sr: expect.objectContaining({
          name_label: 'Imported Archive SR',
          health: 'healthy',
        }),
      }));
    });

    it('probeStorageRepository should fall back to legacy SR.probe output when probe_ext is unavailable', async () => {
      const callSpy = jest.spyOn(xenApi, 'call')
        .mockRejectedValueOnce(new Error('MESSAGE_METHOD_UNKNOWN'))
        .mockResolvedValueOnce('<probe><sr uuid="imported-nfs-uuid" /></probe>');

      const result = await xenApi.probeStorageRepository({
        hostRef: 'OpaqueRef:host1',
        type: 'nfs',
        deviceConfig: {
          server: '10.42.0.25',
        },
        smConfig: {},
      });

      expect(callSpy).toHaveBeenNthCalledWith(1, 'SR', 'probe_ext', [
        'OpaqueRef:host1',
        {
          server: '10.42.0.25',
        },
        'nfs',
        {},
      ]);
      expect(callSpy).toHaveBeenNthCalledWith(2, 'SR', 'probe', [
        'OpaqueRef:host1',
        {
          server: '10.42.0.25',
        },
        'nfs',
        {},
      ]);
      expect(result).toEqual(expect.objectContaining({
        mode: 'probe',
        rawXml: '<probe><sr uuid="imported-nfs-uuid" /></probe>',
        results: [],
        summary: expect.objectContaining({
          legacyXmlAvailable: true,
        }),
      }));
    });

    it('importStorageRepository should introduce a new SR, create a host PBD, plug it, and rescan', async () => {
      const callSpy = jest.spyOn(xenApi, 'call')
        .mockRejectedValueOnce(new Error('UUID_INVALID'))
        .mockResolvedValueOnce('OpaqueRef:sr9')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      const createSpy = jest.spyOn(xenApi, 'create').mockResolvedValue('OpaqueRef:pbd9');
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          name_label: 'Imported Archive SR',
          PBDs: [],
        })
        .mockResolvedValueOnce({
          name_label: 'Imported Archive SR',
          uuid: 'imported-nfs-uuid',
          PBDs: ['OpaqueRef:pbd9'],
        });

      const result = await xenApi.importStorageRepository({
        hostRef: 'OpaqueRef:host1',
        uuid: 'imported-nfs-uuid',
        nameLabel: 'Imported Archive SR',
        nameDescription: 'Existing repository discovered during probe.',
        type: 'nfs',
        contentType: 'user',
        shared: true,
        deviceConfig: {
          server: '10.42.0.25',
          serverpath: '/exports/xen/imported',
        },
        smConfig: {},
      });

      expect(callSpy).toHaveBeenNthCalledWith(1, 'SR', 'get_by_uuid', ['imported-nfs-uuid']);
      expect(callSpy).toHaveBeenNthCalledWith(2, 'SR', 'introduce', [
        'imported-nfs-uuid',
        'Imported Archive SR',
        'Existing repository discovered during probe.',
        'nfs',
        'user',
        true,
        {},
      ]);
      expect(createSpy).toHaveBeenCalledWith('PBD', {
        host: 'OpaqueRef:host1',
        SR: 'OpaqueRef:sr9',
        device_config: {
          server: '10.42.0.25',
          serverpath: '/exports/xen/imported',
        },
        other_config: {},
      });
      expect(callSpy).toHaveBeenNthCalledWith(3, 'PBD', 'plug', ['OpaqueRef:pbd9']);
      expect(callSpy).toHaveBeenNthCalledWith(4, 'SR', 'scan', ['OpaqueRef:sr9']);
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:sr9',
        pbdRef: 'OpaqueRef:pbd9',
        introduced: true,
        createdPbd: true,
        pluggedPbd: true,
        attachedHostRef: 'OpaqueRef:host1',
      }));
      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'SR', 'OpaqueRef:sr9');
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'SR', 'OpaqueRef:sr9');
    });

    it('repairSR should refresh the SR, replug detached PBDs, and rescan the repository', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          name_label: 'Primary SR',
          PBDs: ['OpaqueRef:pbd1', 'OpaqueRef:pbd2'],
        })
        .mockResolvedValueOnce({
          currently_attached: false,
        })
        .mockResolvedValueOnce({
          currently_attached: true,
        })
        .mockResolvedValueOnce({
          name_label: 'Primary SR',
          PBDs: ['OpaqueRef:pbd1', 'OpaqueRef:pbd2'],
          other_config: { repaired: 'true' },
        });

      const result = await xenApi.repairSR('OpaqueRef:sr1');

      expect(callSpy).toHaveBeenNthCalledWith(1, 'SR', 'update', ['OpaqueRef:sr1']);
      expect(callSpy).toHaveBeenNthCalledWith(2, 'PBD', 'plug', ['OpaqueRef:pbd1']);
      expect(callSpy).toHaveBeenNthCalledWith(3, 'SR', 'scan', ['OpaqueRef:sr1']);
      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'SR', 'OpaqueRef:sr1');
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'PBD', 'OpaqueRef:pbd1');
      expect(getRecordSpy).toHaveBeenNthCalledWith(3, 'PBD', 'OpaqueRef:pbd2');
      expect(getRecordSpy).toHaveBeenNthCalledWith(4, 'SR', 'OpaqueRef:sr1');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:sr1',
        checkedPbdRefs: ['OpaqueRef:pbd1', 'OpaqueRef:pbd2'],
        repairedPbdRefs: ['OpaqueRef:pbd1'],
        reattachedCount: 1,
        name_label: 'Primary SR',
      }));
    });

    it('setStorageLocalCache should enable local caching on a host-attached local repository', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          name_label: 'Primary SR',
          shared: false,
          PBDs: ['OpaqueRef:pbd1', 'OpaqueRef:pbd2'],
        })
        .mockResolvedValueOnce({
          host: 'OpaqueRef:host1',
          currently_attached: true,
        })
        .mockResolvedValueOnce({
          name_label: 'Primary SR',
          shared: false,
          PBDs: ['OpaqueRef:pbd1', 'OpaqueRef:pbd2'],
          local_cache_enabled: true,
        });

      const result = await xenApi.setStorageLocalCache('OpaqueRef:sr1', {
        hostRef: 'OpaqueRef:host1',
        enabled: true,
      });

      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'SR', 'OpaqueRef:sr1');
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'PBD', 'OpaqueRef:pbd1');
      expect(callSpy).toHaveBeenCalledWith('host', 'enable_local_storage_caching', ['OpaqueRef:host1', 'OpaqueRef:sr1']);
      expect(getRecordSpy).toHaveBeenNthCalledWith(3, 'SR', 'OpaqueRef:sr1');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:sr1',
        hostRef: 'OpaqueRef:host1',
        matchedPbdRef: 'OpaqueRef:pbd1',
        requestedEnabled: true,
        local_cache_enabled: true,
        name_label: 'Primary SR',
      }));
    });

    it('updateStorageConfig should persist SR name, description, tags, and editable other_config values before returning the refreshed record', async () => {
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          other_config: {
            last_rescan_at: '2026-08-26T18:45:00.000Z',
            owner: 'platform-ops',
          },
        })
        .mockResolvedValueOnce({
          name_label: 'Primary SR Renamed',
          name_description: 'Updated operator-facing description for the primary repository.',
          tags: ['flash', 'tier-2'],
          other_config: {
            last_rescan_at: '2026-08-26T18:45:00.000Z',
            owner: 'storage-team',
            tier: 'gold',
          },
        });

      const result = await xenApi.updateStorageConfig('OpaqueRef:sr1', {
        nameLabel: 'Primary SR Renamed',
        nameDescription: 'Updated operator-facing description for the primary repository.',
        tags: ['flash', 'tier-2'],
        otherConfig: {
          owner: 'storage-team',
          tier: 'gold',
        },
      });

      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'SR', 'OpaqueRef:sr1');
      expect(setFieldSpy).toHaveBeenNthCalledWith(1, 'SR', 'OpaqueRef:sr1', 'name_label', 'Primary SR Renamed');
      expect(setFieldSpy).toHaveBeenNthCalledWith(2, 'SR', 'OpaqueRef:sr1', 'name_description', 'Updated operator-facing description for the primary repository.');
      expect(setFieldSpy).toHaveBeenNthCalledWith(3, 'SR', 'OpaqueRef:sr1', 'tags', ['flash', 'tier-2']);
      expect(setFieldSpy).toHaveBeenNthCalledWith(4, 'SR', 'OpaqueRef:sr1', 'other_config', {
        last_rescan_at: '2026-08-26T18:45:00.000Z',
        owner: 'storage-team',
        tier: 'gold',
      });
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'SR', 'OpaqueRef:sr1');
      expect(result).toEqual(expect.objectContaining({
        name_label: 'Primary SR Renamed',
        name_description: 'Updated operator-facing description for the primary repository.',
        tags: ['flash', 'tier-2'],
        other_config: expect.objectContaining({
          last_rescan_at: '2026-08-26T18:45:00.000Z',
          owner: 'storage-team',
          tier: 'gold',
        }),
      }));
    });
  });

  describe('network methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
    });

    it('createNetwork should submit the documented network record constructor and return the refreshed record', async () => {
      const createSpy = jest.spyOn(xenApi, 'create').mockResolvedValue('OpaqueRef:net9');
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'Replication Transit',
        name_description: 'Dedicated replication bridge for backup copy traffic.',
        bridge: 'xenbr10',
        MTU: 1600,
        managed: true,
        tags: ['replication', 'backup'],
        other_config: { vlan: '330', domain: 'replication' },
      });

      const result = await xenApi.createNetwork({
        nameLabel: 'Replication Transit',
        nameDescription: 'Dedicated replication bridge for backup copy traffic.',
        mtu: 1600,
        bridge: 'xenbr10',
        tags: ['replication', 'backup'],
        otherConfig: {
          vlan: '330',
          domain: 'replication',
        },
      });

      expect(createSpy).toHaveBeenCalledWith('network', {
        name_label: 'Replication Transit',
        name_description: 'Dedicated replication bridge for backup copy traffic.',
        MTU: 1600,
        other_config: {
          vlan: '330',
          domain: 'replication',
        },
        bridge: 'xenbr10',
        managed: true,
        tags: ['replication', 'backup'],
      });
      expect(getRecordSpy).toHaveBeenCalledWith('network', 'OpaqueRef:net9');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:net9',
        name_label: 'Replication Transit',
        bridge: 'xenbr10',
        MTU: 1600,
      }));
    });

    it('createVlan should call the documented VLAN create message and return the refreshed vlan record plus network context', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue('OpaqueRef:vlan1');
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          tagged_PIF: 'OpaqueRef:pif2',
          untagged_PIF: 'OpaqueRef:pif9',
          tag: 330,
          other_config: {},
          uuid: 'vlan-uuid-1',
        })
        .mockResolvedValueOnce({
          name_label: 'Backup Network',
          bridge: 'xenbr1',
          other_config: { vlan: '330' },
        });

      const result = await xenApi.createVlan({
        networkRef: 'OpaqueRef:net2',
        pifRef: 'OpaqueRef:pif2',
        tag: 330,
      });

      expect(callSpy).toHaveBeenCalledWith('VLAN', 'create', ['OpaqueRef:pif2', 330, 'OpaqueRef:net2']);
      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'VLAN', 'OpaqueRef:vlan1');
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'network', 'OpaqueRef:net2');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vlan1',
        networkRef: 'OpaqueRef:net2',
        taggedPifRef: 'OpaqueRef:pif2',
        tag: 330,
        network: expect.objectContaining({
          ref: 'OpaqueRef:net2',
          name_label: 'Backup Network',
        }),
      }));
    });

    it('createBond should call the documented Bond create message and return the refreshed bond record plus network context', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue('OpaqueRef:bond1');
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          master: 'OpaqueRef:pif2',
          slaves: ['OpaqueRef:pif2', 'OpaqueRef:pif4'],
          primary_slave: 'OpaqueRef:pif2',
          links_up: 2,
          mode: 'lacp',
          other_config: {},
          properties: {},
          uuid: 'bond-uuid-1',
        })
        .mockResolvedValueOnce({
          name_label: 'Backup Network',
          bridge: 'xenbr1',
          other_config: { bond_mode: 'lacp' },
        });

      const result = await xenApi.createBond({
        networkRef: 'OpaqueRef:net2',
        pifRefs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'],
        mode: 'lacp',
      });

      expect(callSpy).toHaveBeenCalledWith('Bond', 'create', ['OpaqueRef:net2', ['OpaqueRef:pif2', 'OpaqueRef:pif4'], '', 'lacp', {}]);
      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'Bond', 'OpaqueRef:bond1');
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'network', 'OpaqueRef:net2');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:bond1',
        networkRef: 'OpaqueRef:net2',
        memberPifRefs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'],
        mode: 'lacp',
        network: expect.objectContaining({
          ref: 'OpaqueRef:net2',
          name_label: 'Backup Network',
        }),
      }));
    });

    it('updateNetworkConfig should persist network name, description, MTU, tags, and other_config before returning the refreshed record', async () => {
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
        name_label: 'VM Network',
        name_description: 'Primary east-west traffic segment.',
        MTU: 1500,
        default_locking_mode: 'unlocked',
        purpose: [],
        tags: ['prod'],
          other_config: {
            vlan: '120',
          },
        })
        .mockResolvedValueOnce({
        name_label: 'Production VM Network',
        name_description: 'Updated east-west traffic segment.',
        MTU: 1600,
        default_locking_mode: 'disabled',
        purpose: ['nbd'],
        tags: ['prod', 'east-west'],
        other_config: {
          vlan: '130',
          owner: 'platform-ops',
        },
        });

      const result = await xenApi.updateNetworkConfig('OpaqueRef:net1', {
        nameLabel: 'Production VM Network',
        nameDescription: 'Updated east-west traffic segment.',
        mtu: 1600,
        defaultLockingMode: 'disabled',
        purpose: ['nbd'],
        tags: ['prod', 'east-west'],
        otherConfig: {
          vlan: '130',
          owner: 'platform-ops',
        },
      });

      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'network', 'OpaqueRef:net1');
      expect(setFieldSpy).toHaveBeenNthCalledWith(1, 'network', 'OpaqueRef:net1', 'name_label', 'Production VM Network');
      expect(setFieldSpy).toHaveBeenNthCalledWith(2, 'network', 'OpaqueRef:net1', 'name_description', 'Updated east-west traffic segment.');
      expect(setFieldSpy).toHaveBeenNthCalledWith(3, 'network', 'OpaqueRef:net1', 'MTU', 1600);
      expect(callSpy).toHaveBeenNthCalledWith(1, 'network', 'set_default_locking_mode', ['OpaqueRef:net1', 'disabled']);
      expect(callSpy).toHaveBeenNthCalledWith(2, 'network', 'add_purpose', ['OpaqueRef:net1', 'nbd']);
      expect(setFieldSpy).toHaveBeenNthCalledWith(4, 'network', 'OpaqueRef:net1', 'tags', ['prod', 'east-west']);
      expect(setFieldSpy).toHaveBeenNthCalledWith(5, 'network', 'OpaqueRef:net1', 'other_config', {
        vlan: '130',
        owner: 'platform-ops',
      });
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'network', 'OpaqueRef:net1');
      expect(result).toEqual(expect.objectContaining({
        name_label: 'Production VM Network',
        name_description: 'Updated east-west traffic segment.',
        MTU: 1600,
        default_locking_mode: 'disabled',
        purpose: ['nbd'],
        tags: ['prod', 'east-west'],
        other_config: expect.objectContaining({
          vlan: '130',
          owner: 'platform-ops',
        }),
      }));
    });

    it('updateVifConfig should persist VIF QoS configuration before returning the refreshed record', async () => {
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        VM: 'OpaqueRef:vm1',
        network: 'OpaqueRef:net1',
        qos_algorithm_type: 'ratelimit',
        qos_algorithm_params: {
          kbps: '75000',
          timeslice_us: '50000',
        },
      });

      const result = await xenApi.updateVifConfig('OpaqueRef:vif1', {
        qosAlgorithmType: 'ratelimit',
        qosAlgorithmParams: {
          kbps: '75000',
          timeslice_us: '50000',
        },
      });

      expect(setFieldSpy).toHaveBeenNthCalledWith(1, 'VIF', 'OpaqueRef:vif1', 'qos_algorithm_type', 'ratelimit');
      expect(setFieldSpy).toHaveBeenNthCalledWith(2, 'VIF', 'OpaqueRef:vif1', 'qos_algorithm_params', {
        kbps: '75000',
        timeslice_us: '50000',
      });
      expect(getRecordSpy).toHaveBeenCalledWith('VIF', 'OpaqueRef:vif1');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vif1',
        qos_algorithm_type: 'ratelimit',
        qos_algorithm_params: {
          kbps: '75000',
          timeslice_us: '50000',
        },
      }));
    });

    it('destroyNetwork should call the documented network destroy message and return a success envelope', async () => {
      const destroySpy = jest.spyOn(xenApi, 'destroy').mockResolvedValue(undefined);

      const result = await xenApi.destroyNetwork('OpaqueRef:net2');

      expect(destroySpy).toHaveBeenCalledWith('network', 'OpaqueRef:net2');
      expect(result).toEqual({
        success: true,
        ref: 'OpaqueRef:net2',
      });
    });
  });

  describe('VM interface methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
    });

    it('disconnectVMNic should hot-unplug an attached VIF and return refreshed state', async () => {
      const callSpy = jest.spyOn(xenApi, 'call').mockResolvedValue(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          VIFs: ['OpaqueRef:vif1'],
        })
        .mockResolvedValueOnce({
          VM: 'OpaqueRef:vm1',
          network: 'OpaqueRef:net1',
          device: '0',
          MAC: '02:16:3e:10:00:01',
          currently_attached: true,
        })
        .mockResolvedValueOnce({
          VM: 'OpaqueRef:vm1',
          network: 'OpaqueRef:net1',
          device: '0',
          MAC: '02:16:3e:10:00:01',
          currently_attached: false,
        });

      const result = await xenApi.disconnectVMNic('OpaqueRef:vm1', 'OpaqueRef:vif1', { force: true });

      expect(getRecordSpy).toHaveBeenNthCalledWith(1, 'VM', 'OpaqueRef:vm1');
      expect(getRecordSpy).toHaveBeenNthCalledWith(2, 'VIF', 'OpaqueRef:vif1');
      expect(callSpy).toHaveBeenCalledWith('VIF', 'unplug', ['OpaqueRef:vif1']);
      expect(getRecordSpy).toHaveBeenNthCalledWith(3, 'VIF', 'OpaqueRef:vif1');
      expect(result).toEqual({
        success: true,
        vmRef: 'OpaqueRef:vm1',
        vifRef: 'OpaqueRef:vif1',
        networkRef: 'OpaqueRef:net1',
        alreadyDisconnected: false,
        currentlyAttached: false,
        device: '0',
        mac: '02:16:3e:10:00:01',
      });
    });

    it('disconnectVMNic should fall back to unplug_force when a forced hot-unplug is required', async () => {
      const callSpy = jest.spyOn(xenApi, 'call')
        .mockRejectedValueOnce(new Error('DEVICE_DETACH_REQUIRES_FORCE'))
        .mockResolvedValueOnce(undefined);
      const getRecordSpy = jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          VIFs: ['OpaqueRef:vif1'],
        })
        .mockResolvedValueOnce({
          VM: 'OpaqueRef:vm1',
          network: 'OpaqueRef:net1',
          device: '1',
          MAC: '02:16:3e:10:00:09',
          currently_attached: true,
        })
        .mockResolvedValueOnce({
          VM: 'OpaqueRef:vm1',
          network: 'OpaqueRef:net1',
          device: '1',
          MAC: '02:16:3e:10:00:09',
          currently_attached: false,
        });

      const result = await xenApi.disconnectVMNic('OpaqueRef:vm1', 'OpaqueRef:vif1', { force: true });

      expect(callSpy).toHaveBeenNthCalledWith(1, 'VIF', 'unplug', ['OpaqueRef:vif1']);
      expect(callSpy).toHaveBeenNthCalledWith(2, 'VIF', 'unplug_force', ['OpaqueRef:vif1']);
      expect(result).toEqual(expect.objectContaining({
        success: true,
        vifRef: 'OpaqueRef:vif1',
        currentlyAttached: false,
      }));
    });
  });

  describe('template deployment methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
    });

    it('deployTemplate should clone, configure, place, and optionally start the VM', async () => {
      const cloneSpy = jest.spyOn(xenApi, 'cloneVM').mockResolvedValue('OpaqueRef:vm9');
      const configSpy = jest.spyOn(xenApi, 'updateVMConfig').mockResolvedValue({ name_label: 'ubuntu-prod-01' });
      const affinitySpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const nicSpy = jest.spyOn(xenApi, 'addVMNic').mockResolvedValue({ success: true, vifRef: 'OpaqueRef:vif9' });
      const startSpy = jest.spyOn(xenApi, 'startVM').mockResolvedValue(undefined);
      const recordSpy = jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'ubuntu-prod-01',
        power_state: 'Running',
        affinity: 'OpaqueRef:host1',
      });

      const result = await xenApi.deployTemplate('OpaqueRef:template1', {
        nameLabel: 'ubuntu-prod-01',
        nameDescription: 'Primary application deployment',
        hostRef: 'OpaqueRef:host1',
        storageRef: 'OpaqueRef:sr1',
        networkRef: 'OpaqueRef:net1',
        vcpus: 4,
        memoryStaticMax: 8589934592,
        tags: ['prod', 'linux'],
        startAfter: true,
      });

      expect(cloneSpy).toHaveBeenCalledWith('OpaqueRef:template1', 'ubuntu-prod-01');
      expect(configSpy).toHaveBeenCalledWith('OpaqueRef:vm9', expect.objectContaining({
        nameLabel: 'ubuntu-prod-01',
        vcpusAtStartup: 4,
        vcpusMax: 4,
        memoryStaticMax: 8589934592,
        tags: ['prod', 'linux'],
      }));
      expect(affinitySpy).toHaveBeenCalledWith('VM', 'OpaqueRef:vm9', 'affinity', 'OpaqueRef:host1');
      expect(nicSpy).toHaveBeenCalledWith('OpaqueRef:vm9', expect.objectContaining({ networkRef: 'OpaqueRef:net1' }));
      expect(startSpy).toHaveBeenCalledWith('OpaqueRef:vm9', false, false);
      expect(recordSpy).toHaveBeenCalledWith('VM', 'OpaqueRef:vm9');
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vm9',
        storageRef: 'OpaqueRef:sr1',
        name_label: 'ubuntu-prod-01',
      }));
    });

    it('deployTemplate should tolerate NIC provisioning errors when network attachment is deferred', async () => {
      jest.spyOn(xenApi, 'cloneVM').mockResolvedValue('OpaqueRef:vm10');
      jest.spyOn(xenApi, 'updateVMConfig').mockResolvedValue({ name_label: 'ubuntu-prod-02' });
      jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'addVMNic').mockRejectedValue(new Error('VIF_ATTACH_DEFERRED'));
      const startSpy = jest.spyOn(xenApi, 'startVM').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord').mockResolvedValue({
        name_label: 'ubuntu-prod-02',
        power_state: 'Halted',
      });

      const result = await xenApi.deployTemplate('OpaqueRef:template2', {
        nameLabel: 'ubuntu-prod-02',
        hostRef: 'OpaqueRef:host2',
        networkRef: 'OpaqueRef:net2',
        vcpus: 2,
        memoryStaticMax: 4294967296,
      });

      expect(startSpy).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        ref: 'OpaqueRef:vm10',
        name_label: 'ubuntu-prod-02',
      }));
    });

    it('deployComposeVM provisions a golden clone without erasing template metadata', async () => {
      jest.spyOn(xenApi, 'getVmCreationSources').mockResolvedValue({
        operatingSystems: [],
        deployableTemplates: [{ ref: 'OpaqueRef:golden', name_label: 'ubuntu-24-golden' }],
      });
      jest.spyOn(xenApi, 'cloneVM').mockResolvedValue('OpaqueRef:vm-compose');
      const callSpy = jest.spyOn(xenApi, 'call').mockImplementation(async (className, methodName) => {
        if (className === 'VM' && methodName === 'get_allowed_VIF_devices') return ['0', '1'];
        return undefined;
      });
      const setFieldSpy = jest.spyOn(xenApi, 'setField').mockResolvedValue(undefined);
      const destroySpy = jest.spyOn(xenApi, 'destroy').mockResolvedValue(undefined);
      const diskSpy = jest.spyOn(xenApi, 'addVMDisk').mockResolvedValue({ success: true });
      const nicSpy = jest.spyOn(xenApi, 'addVMNic').mockResolvedValue({ success: true });
      const startSpy = jest.spyOn(xenApi, 'startVM').mockResolvedValue(undefined);
      jest.spyOn(xenApi, 'getRecord')
        .mockResolvedValueOnce({
          VIFs: ['OpaqueRef:template-vif'],
          other_config: { 'template-key': 'retained' },
          xenstore_data: { 'template-data': 'retained' },
        })
        .mockResolvedValueOnce({ name_label: 'web-01', power_state: 'Running' });

      const result = await xenApi.deployComposeVM('OpaqueRef:golden', {
        nameLabel: 'web-01',
        memoryStaticMax: 4294967296,
        memoryDynamicMin: 2147483648,
        memoryDynamicMax: 4294967296,
        vcpusAtStartup: 2,
        vcpusMax: 4,
        affinity: 'OpaqueRef:host1',
        disks: [{ srRef: 'OpaqueRef:sr1', sizeBytes: 42949672960, nameLabel: 'web-01-data' }],
        networkInterfaces: [{ networkRef: 'OpaqueRef:net1', mac: '02:16:3e:10:00:01' }],
        otherConfig: { 'compose-key': 'set' },
        xenstoreData: { 'compose-data': 'set' },
        startAfter: true,
      });

      expect(callSpy).toHaveBeenCalledWith('VM', 'remove_from_other_config', ['OpaqueRef:vm-compose', 'disks']);
      expect(callSpy).toHaveBeenCalledWith('VM', 'provision', ['OpaqueRef:vm-compose']);
      expect(setFieldSpy).toHaveBeenCalledWith('VM', 'OpaqueRef:vm-compose', 'other_config', {
        'template-key': 'retained',
        'compose-key': 'set',
      });
      expect(destroySpy).toHaveBeenCalledWith('VIF', 'OpaqueRef:template-vif');
      expect(diskSpy).toHaveBeenCalledWith('OpaqueRef:vm-compose', expect.objectContaining({ bootable: false }));
      expect(nicSpy).toHaveBeenCalledWith('OpaqueRef:vm-compose', expect.objectContaining({ deviceLabel: '0' }));
      expect(startSpy).toHaveBeenCalledWith('OpaqueRef:vm-compose', false, false);
      expect(result).toEqual(expect.objectContaining({ ref: 'OpaqueRef:vm-compose', name_label: 'web-01' }));
    });
  });
});
