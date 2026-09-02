const { getApiRateLimitKey } = require('../../../../server/middleware/rate-limit');

describe('API rate limit middleware', () => {
  it('uses the authenticated user as the stable rate-limit key', () => {
    expect(getApiRateLimitKey({
      session: { user: { id: 42 } },
      sessionID: 'session-a',
      ip: '127.0.0.1',
    })).toBe('user:42');
  });

  it('uses the session before falling back to the client IP', () => {
    expect(getApiRateLimitKey({
      session: {},
      sessionID: 'session-a',
      ip: '127.0.0.1',
    })).toBe('session:session-a');
  });

  it('normalizes IPv6 addresses for anonymous requests', () => {
    expect(getApiRateLimitKey({
      session: {},
      ip: '::1',
    })).toBe('ip:::/56');
  });
});
