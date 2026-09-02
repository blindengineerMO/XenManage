const { getCsrfToken, tokensMatch } = require('../../../../server/middleware/csrf');

describe('CSRF middleware helpers', () => {
  it('creates one stable session-bound token', () => {
    const req = { session: {} };
    const token = getCsrfToken(req);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(getCsrfToken(req)).toBe(token);
  });

  it('accepts only an exact token match', () => {
    expect(tokensMatch('expected', 'expected')).toBe(true);
    expect(tokensMatch('expected', 'different')).toBe(false);
    expect(tokensMatch('expected', '')).toBe(false);
  });
});
