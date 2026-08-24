const { XenAPI } = require('../../../server/services/xenapi');

// Mock axios
jest.mock('axios');

describe('XenAPI', () => {
  let xenApi;
  let mockPost;

  beforeEach(() => {
    const axios = require('axios');
    mockPost = jest.fn();
    axios.create = jest.fn(() => ({
      post: mockPost,
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
