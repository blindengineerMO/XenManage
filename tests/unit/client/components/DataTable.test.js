const DataTable = require('../../../../client/assets/js/components/controls/DataTable');

describe('DataTable sticky column helpers', () => {
  function createVm(overrides = {}) {
    const vm = {
      columns: [],
      selectable: false,
      sortKey: '',
      ...DataTable.methods,
      ...overrides,
    };

    vm.hasStickyActionColumn = DataTable.computed.hasStickyActionColumn.call(vm);
    vm.tableStickyVars = DataTable.computed.tableStickyVars.call(vm);
    return vm;
  }

  it('marks the first data column and trailing actions column as sticky', () => {
    const vm = createVm({
      selectable: true,
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'target', label: 'Target' },
        { key: 'actions', label: 'Actions' },
      ],
      sortKey: 'name',
    });

    expect(vm.hasStickyActionColumn).toBe(true);
    expect(vm.tableStickyVars).toEqual({ '--data-table-sticky-first-left': '44px' });
    expect(vm.headerClass(vm.columns[0])).toEqual({
      sorted: true,
      'data-table-sticky-start': true,
      'data-table-sticky-end': false,
    });
    expect(vm.cellClass(vm.columns[2])).toEqual({
      'data-table-sticky-start': false,
      'data-table-sticky-end': true,
      'data-table-cell-truncate': false,
    });
  });

  it('does not mark a trailing non-action column as sticky-end', () => {
    const vm = createVm({
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'uuid', label: 'UUID' },
      ],
    });

    expect(vm.hasStickyActionColumn).toBe(false);
    expect(vm.tableStickyVars).toEqual({ '--data-table-sticky-first-left': '0px' });
    expect(vm.isStickyFirstColumn(vm.columns[0])).toBe(true);
    expect(vm.isStickyActionColumn(vm.columns[1])).toBe(false);
  });

  it('exposes the full cell value as a title only for truncated columns', () => {
    const column = { key: 'uuid', label: 'UUID', truncate: true };
    const plainColumn = { key: 'name', label: 'Name' };
    const row = { uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Example' };

    expect(DataTable.methods.cellTitle.call({}, row, column)).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(DataTable.methods.cellTitle.call({}, row, plainColumn)).toBeUndefined();
    expect(DataTable.methods.cellTitle.call({}, { uuid: '' }, column)).toBeUndefined();
  });

  it('caps the skeleton loading row count at the page size', () => {
    expect(DataTable.computed.skeletonRowCount.call({ pageSize: 25 })).toBe(5);
    expect(DataTable.computed.skeletonRowCount.call({ pageSize: 3 })).toBe(3);
    expect(DataTable.computed.skeletonRowCount.call({ pageSize: 0 })).toBe(5);
  });
});
