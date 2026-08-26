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

  describe('storage methods', () => {
    beforeEach(() => {
      xenApi.sessionRef = 'OpaqueRef:session123';
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
        vcpus: 4,
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
  });
});
