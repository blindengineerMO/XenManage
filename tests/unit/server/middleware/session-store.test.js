const { SqliteSessionStore, getExpiryFromSession } = require('../../../../server/middleware/session-store');
const { getSecurityDb, sessionStoreModel } = require('../../../../server/models/security-db');

describe('SqliteSessionStore', () => {
  const store = new SqliteSessionStore({ fallbackMaxAge: 60000 });

  beforeEach(() => {
    getSecurityDb().prepare('DELETE FROM sessions').run();
  });

  afterAll(() => {
    getSecurityDb().prepare('DELETE FROM sessions').run();
  });

  it('computes expiry from cookie maxAge when no explicit expires is present', () => {
    const expiry = getExpiryFromSession({ cookie: { maxAge: 120000 } }, 60000);
    expect(expiry).toBeGreaterThan(Date.now() + 60000);
    expect(expiry).toBeLessThanOrEqual(Date.now() + 121000);
  });

  it('stores and loads session payloads from sqlite', (done) => {
    const payload = {
      cookie: { maxAge: 60000 },
      authenticated: true,
      xenHost: '192.168.1.100',
      xenSessionRef: 'OpaqueRef:session123',
    };

    store.set('sid-test-1', payload, (setError) => {
      expect(setError).toBeNull();
      const row = sessionStoreModel.get('sid-test-1');
      expect(row).toBeTruthy();

      store.get('sid-test-1', (getError, session) => {
        expect(getError).toBeNull();
        expect(session).toEqual(expect.objectContaining({
          authenticated: true,
          xenHost: '192.168.1.100',
          xenSessionRef: 'OpaqueRef:session123',
        }));
        done();
      });
    });
  });

  it('touches and destroys session records', (done) => {
    const payload = { cookie: { maxAge: 60000 }, authenticated: true };

    store.set('sid-test-2', payload, (setError) => {
      expect(setError).toBeNull();
      const before = sessionStoreModel.get('sid-test-2');
      expect(before).toBeTruthy();

      store.touch('sid-test-2', { cookie: { maxAge: 180000 } }, (touchError) => {
        expect(touchError).toBeNull();
        const after = sessionStoreModel.get('sid-test-2');
        expect(after.expires_at).toBeGreaterThan(before.expires_at);

        store.destroy('sid-test-2', (destroyError) => {
          expect(destroyError).toBeNull();
          expect(sessionStoreModel.get('sid-test-2')).toBeNull();
          done();
        });
      });
    });
  });

  it('returns null for expired sessions and purges them', (done) => {
    sessionStoreModel.set('sid-expired', JSON.stringify({ authenticated: true }), Date.now() - 1000);

    store.get('sid-expired', (error, session) => {
      expect(error).toBeNull();
      expect(session).toBeNull();
      expect(sessionStoreModel.get('sid-expired')).toBeNull();
      done();
    });
  });
});
