const { isIpAllowed } = require('../../../../server/services/identity');

describe('identity.isIpAllowed', () => {
  it('allows any address when the list is empty', () => {
    expect(isIpAllowed([], '203.0.113.5')).toBe(true);
    expect(isIpAllowed(undefined, '203.0.113.5')).toBe(true);
  });

  it('matches an exact IPv4 address', () => {
    expect(isIpAllowed(['203.0.113.5'], '203.0.113.5')).toBe(true);
    expect(isIpAllowed(['203.0.113.5'], '203.0.113.6')).toBe(false);
  });

  it('matches an IPv4 CIDR range', () => {
    expect(isIpAllowed(['10.0.0.0/8'], '10.42.1.9')).toBe(true);
    expect(isIpAllowed(['10.0.0.0/8'], '11.0.0.1')).toBe(false);
    expect(isIpAllowed(['192.168.1.0/24'], '192.168.1.254')).toBe(true);
    expect(isIpAllowed(['192.168.1.0/24'], '192.168.2.1')).toBe(false);
  });

  it('normalizes IPv6-mapped IPv4 addresses before matching', () => {
    expect(isIpAllowed(['127.0.0.1/32'], '::ffff:127.0.0.1')).toBe(true);
  });

  it('matches an exact IPv6 address', () => {
    expect(isIpAllowed(['::1'], '::1')).toBe(true);
    expect(isIpAllowed(['::1'], '::2')).toBe(false);
  });

  it('rejects when no entry matches across a mixed list', () => {
    expect(isIpAllowed(['10.0.0.0/8', '::1'], '203.0.113.5')).toBe(false);
  });
});
