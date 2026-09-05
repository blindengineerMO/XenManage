const {
  findStorageByFocus,
  resolveFocusedStorageTarget,
} = require('../../../../client/assets/js/core/storage-view-focus');

function normalizeFocusValue(value) {
  return String(value || '').trim().toLowerCase();
}

function recordMatchesRouteFocus(record, focus, fields = [], extraValues = []) {
  if (!record || !focus) return false;
  const values = [...fields.map((field) => record?.[field]), ...extraValues]
    .map(normalizeFocusValue)
    .filter(Boolean);
  if (focus.ref && values.includes(normalizeFocusValue(focus.ref))) return true;
  if (focus.uuid && values.includes(normalizeFocusValue(focus.uuid))) return true;
  if (focus.name && values.includes(normalizeFocusValue(focus.name))) return true;
  return false;
}

describe('storage-view-focus', () => {
  beforeAll(() => {
    global.recordMatchesRouteFocus = recordMatchesRouteFocus;
  });

  afterAll(() => {
    delete global.recordMatchesRouteFocus;
  });

  const srs = [{ ref: 'OpaqueRef:sr1', uuid: 'sr-uuid-1', name_label: 'Primary SR' }];

  it('resolves a direct SR-level focus without touching VDIs or VBDs', async () => {
    const loadSrVdis = jest.fn();
    const loadVbds = jest.fn();
    const target = await resolveFocusedStorageTarget({
      srs,
      focus: { cls: 'sr', ref: 'OpaqueRef:sr1' },
      loadSrVdis,
      loadVbds,
    });

    expect(target.sr).toBe(srs[0]);
    expect(loadSrVdis).not.toHaveBeenCalled();
    expect(loadVbds).not.toHaveBeenCalled();
  });

  it('resolves a focused VBD by uuid via a real VBD record, not just its opaque ref', async () => {
    const vdis = [{ ref: 'OpaqueRef:vdi1', uuid: 'vdi-uuid-1', VBDs: ['OpaqueRef:vbd1'] }];
    const vbds = [{ ref: 'OpaqueRef:vbd1', uuid: 'vbd-uuid-1', VDI: 'OpaqueRef:vdi1' }];
    const loadSrVdis = jest.fn(async () => ({ data: vdis }));
    const loadVbds = jest.fn(async () => ({ data: vbds }));

    const target = await resolveFocusedStorageTarget({
      srs,
      focus: { cls: 'vbd', uuid: 'vbd-uuid-1' },
      loadSrVdis,
      loadVbds,
    });

    expect(target.sr).toBe(srs[0]);
    expect(target.focusedVdi).toBe(vdis[0]);
    expect(target.focusedVbd).toBe(vbds[0]);
    expect(loadVbds).toHaveBeenCalledTimes(1);
  });

  it('falls back to ref-only VDI-list matching when the batched VBD fetch fails', async () => {
    const vdis = [{ ref: 'OpaqueRef:vdi2', uuid: 'vdi-uuid-2', VBDs: ['OpaqueRef:vbd2'] }];
    const loadSrVdis = jest.fn(async () => ({ data: vdis }));
    const loadVbds = jest.fn(async () => { throw new Error('boom'); });

    const target = await resolveFocusedStorageTarget({
      srs,
      focus: { cls: 'vbd', ref: 'OpaqueRef:vbd2' },
      loadSrVdis,
      loadVbds,
    });

    expect(target.sr).toBe(srs[0]);
    expect(target.focusedVdi).toBe(vdis[0]);
    expect(target.focusedVbd).toBeNull();
  });

  it('finds a saved SR by ref, uuid, or name label', () => {
    expect(findStorageByFocus(srs, { ref: 'OpaqueRef:sr1' })).toBe(srs[0]);
    expect(findStorageByFocus(srs, { uuid: 'sr-uuid-1' })).toBe(srs[0]);
    expect(findStorageByFocus(srs, { ref: 'OpaqueRef:missing' })).toBeNull();
  });
});
