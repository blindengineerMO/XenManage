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
});
