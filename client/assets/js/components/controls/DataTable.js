const DataTable = {
  props: ['columns', 'data', 'loading', 'searchable', 'selectable', 'selectedKeys', 'rowKey'],
  emits: ['row-click', 'selection-change', 'cell-edit'],
  template: `
    <div class="data-table-wrap" :style="tableStickyVars">
      <div class="data-table-toolbar" v-if="searchable">
        <input class="data-table-search" placeholder="Search..." v-model="searchQuery" @input="page = 1">
        <span class="text-muted mono" style="font-size:11px">{{ filteredData.length }} records</span>
      </div>
      <div class="data-table-scroller">
        <table class="data-table">
          <thead>
            <tr>
              <th v-if="selectable"
                  class="data-table-sticky-select"
                  style="width:44px">
                <input type="checkbox"
                       :checked="allPageSelected"
                       :disabled="loading || paginatedData.length === 0"
                       @click.stop="toggleAllPageSelection">
              </th>
              <th v-for="column in columns" :key="column.key"
                  :class="headerClass(column)"
                  @click="onSort(column.key)">
                {{ column.label }}
                <span v-if="sortKey === column.key"
                      class="mdi"
                      :class="sortDir === 'asc' ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                      style="font-size:12px"></span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="columnCount" style="text-align:center;padding:24px">
                <span class="loading-spinner"></span>
              </td>
            </tr>
            <tr v-else-if="filteredData.length === 0">
              <td :colspan="columnCount" class="empty-state">
                <p>No data available</p>
              </td>
            </tr>
            <tr v-for="(row, index) in paginatedData" :key="rowIdentifier(row, index)" @click="$emit('row-click', row)">
              <td v-if="selectable" class="data-table-sticky-select" @click.stop>
                <input type="checkbox"
                       :checked="isSelected(row, index)"
                       :aria-label="'Select ' + String(row.name_label || row.name || row.summary || row.ref || index)"
                       @click.stop="toggleRowSelection(row, index)">
              </td>
              <td v-for="column in columns" :key="column.key" :class="cellClass(column)">
                <input v-if="column.editable && isEditingCell(row, column, index)"
                       ref="inlineEditor"
                       class="data-table-inline-input"
                       :value="editingValue"
                       :aria-label="'Edit ' + column.label"
                       @click.stop
                       @input="editingValue = $event.target.value"
                       @keydown.enter.prevent="commitCellEdit(row, column, index)"
                       @keydown.esc.prevent="cancelCellEdit"
                       @blur="commitCellEdit(row, column, index)">
                <button v-else-if="column.editable"
                        class="data-table-inline-value"
                        type="button"
                        :aria-label="'Edit ' + column.label + ': ' + String(row[column.key] || '')"
                        @click.stop="beginCellEdit(row, column, index)">
                  {{ row[column.key] || column.emptyLabel || '-' }}
                </button>
                <template v-else>
                  <slot :name="'cell-' + column.key" :row="row" :value="row[column.key]">
                    {{ row[column.key] }}
                  </slot>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="data-table-pagination" v-if="filteredData.length > pageSize">
        <span>{{ (page - 1) * pageSize + 1 }}-{{ Math.min(page * pageSize, filteredData.length) }} of {{ filteredData.length }}</span>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm" :disabled="page <= 1" @click="page -= 1">
            <span class="mdi mdi-chevron-left"></span>
          </button>
          <button class="btn btn-sm" :disabled="page * pageSize >= filteredData.length" @click="page += 1">
            <span class="mdi mdi-chevron-right"></span>
          </button>
        </div>
      </div>
    </div>
  `,
  data() {
    return {
      searchQuery: '',
      sortKey: '',
      sortDir: 'asc',
      page: 1,
      pageSize: 25,
      editingKey: '',
      editingColumnKey: '',
      editingValue: '',
    };
  },
  computed: {
    columnCount() {
      return (this.columns?.length || 0) + (this.selectable ? 1 : 0);
    },
    hasStickyActionColumn() {
      const columns = Array.isArray(this.columns) ? this.columns : [];
      return columns.length > 1 && columns[columns.length - 1]?.key === 'actions';
    },
    tableStickyVars() {
      return {
        '--data-table-sticky-first-left': this.selectable ? '44px' : '0px',
      };
    },
    filteredData() {
      let rows = this.data || [];

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        rows = rows.filter((row) =>
          Object.values(row).some((value) => String(value || '').toLowerCase().includes(query))
        );
      }

      if (this.sortKey) {
        rows = [...rows].sort((left, right) => {
          const leftValue = left[this.sortKey] || '';
          const rightValue = right[this.sortKey] || '';
          const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
          return this.sortDir === 'asc' ? comparison : -comparison;
        });
      }

      return rows;
    },
    paginatedData() {
      const start = (this.page - 1) * this.pageSize;
      return this.filteredData.slice(start, start + this.pageSize);
    },
    allPageSelected() {
      if (!this.selectable || !this.paginatedData.length) return false;
      return this.paginatedData.every((row, index) => this.isSelected(row, index));
    },
  },
  watch: {
    data() {
      this.page = 1;
    },
  },
  methods: {
    isStickyFirstColumn(column = null) {
      return Boolean(column) && Array.isArray(this.columns) && this.columns[0]?.key === column.key;
    },
    isStickyActionColumn(column = null) {
      if (!this.hasStickyActionColumn || !column) return false;
      const columns = Array.isArray(this.columns) ? this.columns : [];
      return columns[columns.length - 1]?.key === column.key;
    },
    headerClass(column) {
      return {
        sorted: this.sortKey === column.key,
        'data-table-sticky-start': this.isStickyFirstColumn(column),
        'data-table-sticky-end': this.isStickyActionColumn(column),
      };
    },
    cellClass(column) {
      return {
        'data-table-sticky-start': this.isStickyFirstColumn(column),
        'data-table-sticky-end': this.isStickyActionColumn(column),
      };
    },
    rowIdentifier(row, index) {
      const key = this.rowKey || 'ref';
      return row?.[key] || row?.ref || index;
    },
    isSelected(row, index) {
      const selected = Array.isArray(this.selectedKeys) ? this.selectedKeys : [];
      return selected.includes(this.rowIdentifier(row, index));
    },
    toggleRowSelection(row, index) {
      const key = this.rowIdentifier(row, index);
      const selected = new Set(Array.isArray(this.selectedKeys) ? this.selectedKeys : []);
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      this.$emit('selection-change', [...selected]);
    },
    toggleAllPageSelection() {
      const selected = new Set(Array.isArray(this.selectedKeys) ? this.selectedKeys : []);
      if (this.allPageSelected) {
        this.paginatedData.forEach((row, index) => selected.delete(this.rowIdentifier(row, index)));
      } else {
        this.paginatedData.forEach((row, index) => selected.add(this.rowIdentifier(row, index)));
      }
      this.$emit('selection-change', [...selected]);
    },
    onSort(key) {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDir = 'asc';
      }
    },
    editingCellKey(row, column, index) {
      return `${this.rowIdentifier(row, index)}:${column.key}`;
    },
    isEditingCell(row, column, index) {
      return this.editingKey === this.editingCellKey(row, column, index);
    },
    beginCellEdit(row, column, index) {
      this.editingKey = this.editingCellKey(row, column, index);
      this.editingColumnKey = column.key;
      this.editingValue = String(row?.[column.key] || '');
      this.$nextTick(() => this.$refs.inlineEditor?.[0]?.focus());
    },
    cancelCellEdit() {
      this.editingKey = '';
      this.editingColumnKey = '';
      this.editingValue = '';
    },
    commitCellEdit(row, column, index) {
      if (!this.isEditingCell(row, column, index)) return;
      const value = this.editingValue.trim();
      const previousValue = String(row?.[column.key] || '');
      this.cancelCellEdit();
      if (!value || value === previousValue) return;
      this.$emit('cell-edit', { row, key: column.key, value });
    },
  },
};

if (typeof module !== 'undefined') {
  module.exports = DataTable;
}
