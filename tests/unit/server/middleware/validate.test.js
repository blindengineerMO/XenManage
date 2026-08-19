const { validate, schemas } = require('../../../../server/middleware/validate');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('login schema', () => {
    it('should pass with valid login data', () => {
      req.body = { host: '192.168.1.100', username: 'root', password: 'pass' };
      validate(schemas.login)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing host', () => {
      req.body = { username: 'root', password: 'pass' };
      validate(schemas.login)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'VALIDATION_ERROR' })
      );
    });

    it('should reject empty username', () => {
      req.body = { host: '192.168.1.100', username: '', password: 'pass' };
      validate(schemas.login)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should strip unknown fields', () => {
      req.body = { host: '192.168.1.100', username: 'root', password: 'pass', extra: 'data' };
      validate(schemas.login)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body).not.toHaveProperty('extra');
    });
  });

  describe('vmLifecycle schema', () => {
    it('should pass with valid ref', () => {
      req.body = { ref: 'OpaqueRef:12345678-1234-1234-1234-123456789abc' };
      validate(schemas.vmLifecycle)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid ref format', () => {
      req.body = { ref: 'invalid-ref' };
      validate(schemas.vmLifecycle)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should default paused and force to false', () => {
      req.body = { ref: 'OpaqueRef:12345678-1234-1234-1234-123456789abc' };
      validate(schemas.vmLifecycle)(req, res, next);
      expect(req.body.paused).toBe(false);
      expect(req.body.force).toBe(false);
    });
  });

  describe('connection schemas', () => {
    it('should pass valid saved connection payloads', () => {
      req.body = { name: 'Production', host: '10.0.0.1', username: 'root', port: 443, isDefault: true };
      validate(schemas.connectionCreate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.port).toBe(443);
    });

    it('should reject invalid connection ports', () => {
      req.body = { name: 'Production', host: '10.0.0.1', username: 'root', port: 70000 };
      validate(schemas.connectionCreate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate numeric connection ids from route params', () => {
      req.params = { id: '42' };
      validate(schemas.connectionId, 'params')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.params.id).toBe(42);
    });
  });

  describe('paginate schema', () => {
    it('should apply defaults', () => {
      req.body = {};
      validate(schemas.paginate, 'body')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.page).toBe(1);
      expect(req.body.pageSize).toBe(50);
    });

    it('should reject pageSize > 500', () => {
      req.body = { pageSize: 600 };
      validate(schemas.paginate, 'body')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
