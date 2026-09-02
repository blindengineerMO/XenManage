describe('API client CSRF handling', () => {
  beforeEach(() => {
    jest.resetModules();
    global.store = { demoMode: false };
    global.demoRequest = jest.fn();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.store;
    delete global.demoRequest;
    delete global.fetch;
  });

  function response(data, token = '') {
    return {
      ok: true,
      json: jest.fn().mockResolvedValue(data),
      headers: { get: jest.fn().mockReturnValue(token) },
    };
  }

  it('captures a CSRF token from a safe response and sends it with mutations', async () => {
    const { api } = require('../../../../client/assets/js/core/api');
    global.fetch
      .mockResolvedValueOnce(response({ authenticated: false }, 'session-token'))
      .mockResolvedValueOnce(response({ success: true }));

    await api.status();
    await api.login('admin', 'password');

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/auth/status', expect.objectContaining({
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/auth/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'session-token' },
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    }));
  });
});
