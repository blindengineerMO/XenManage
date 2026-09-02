describe('Shared undo state', () => {
  beforeEach(() => {
    jest.resetModules();
    global.reactive = (value) => value;
    global.api = { getGovernance: jest.fn(), getSystemConfig: jest.fn() };
    global.window = {
      sessionStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
      clearTimeout: jest.fn(), clearInterval: jest.fn(), setInterval: jest.fn(), setTimeout: jest.fn(),
    };
  });

  afterEach(() => {
    delete global.reactive;
    delete global.api;
    delete global.window;
  });

  it('normalizes persisted undo delays to the supported 1-60 second range', () => {
    const { normalizeUndoDelaySeconds } = require('../../../../client/assets/js/core/state');
    expect(normalizeUndoDelaySeconds(1)).toBe(1);
    expect(normalizeUndoDelaySeconds('60')).toBe(60);
    expect(normalizeUndoDelaySeconds(0)).toBe(5);
    expect(normalizeUndoDelaySeconds(61)).toBe(5);
  });

  it('applies a valid delay to the active queue configuration', () => {
    const { store, applyUndoDelaySeconds } = require('../../../../client/assets/js/core/state');
    applyUndoDelaySeconds(12);
    expect(store.undoDelaySeconds).toBe(12);
    expect(store.undoDelayLoaded).toBe(true);
  });
});
