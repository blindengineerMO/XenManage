const DataTable = {
  components: { ContextMenu: typeof ContextMenu !== 'undefined' ? ContextMenu : undefined },
  props: ['columns', 'data', 'loading', 'searchable', 'selectable', 'selectedKeys', 'rowKey', 'emptyMessage', 'emptyIcon'],
  emits: ['row-click', 'selection-change', 'cell-edit', 'row-context'],
  template: `
    <div class="data-table-wrap" :style="tableStickyVars">
      <div class="data-table-toolbar" v-if="searchable">
        <input class="data-table-search" placeholder="Search..." v-model="searchQuery" @input="page = 1">
        <span class="text-muted mono" style="font-size:11px">{{ filteredData.length }} records</span>
      </div>
      <div v-if="contextCopyMessage" class="data-table-copy-notice" role="status">{{ contextCopyMessage }}</div>
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
            <template v-if="loading">
              <tr v-for="n in skeletonRowCount" :key="'skeleton-' + n" class="data-table-skeleton-row">
                <td v-if="selectable" class="data-table-sticky-select"><span class="skeleton-bar skeleton-bar-checkbox"></span></td>
                <td v-for="column in columns" :key="column.key"><span class="skeleton-bar"></span></td>
              </tr>
            </template>
            <tr v-else-if="filteredData.length === 0">
              <td :colspan="columnCount" class="empty-state">
                <span v-if="emptyIcon" class="mdi" :class="emptyIcon"></span>
                <p>{{ emptyMessage || 'No data available' }}</p>
                <slot name="empty-action"></slot>
              </td>
            </tr>
            <tr v-for="(row, index) in paginatedData"
                :key="rowIdentifier(row, index)"
                class="data-table-row"
                tabindex="0"
                @click="$emit('row-click', row)"
                @contextmenu.prevent="openRowContextMenu($event, row, index)"
                @keydown="onRowKeydown($event, row, index)">
              <td v-if="selectable" class="data-table-sticky-select" @click.stop>
                <input type="checkbox"
                       :checked="isSelected(row, index)"
                       :aria-label="'Select ' + String(row.name_label || row.name || row.summary || row.ref || index)"
                       @click.stop="toggleRowSelection(row, index)">
              </td>
              <td v-for="column in columns" :key="column.key" :class="cellClass(column)" :title="cellTitle(row, column)">
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
          <button class="btn btn-sm" type="button" aria-label="Previous page" :disabled="page <= 1" @click="page -= 1">
            <span class="mdi mdi-chevron-left"></span>
          </button>
          <button class="btn btn-sm" :disabled="page * pageSize >= filteredData.length" @click="page += 1">
            <span class="mdi mdi-chevron-right"></span>
          </button>
        </div>
      </div>
      <context-menu
        :show="Boolean(contextRow)"
        :x="contextMenuX"
        :y="contextMenuY"
        :items="contextMenuItems"
        @close="closeRowContextMenu"
        @select="handleRowContextAction">
      </context-menu>
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
      contextRow: null,
      contextRowIndex: -1,
      contextMenuX: 0,
      contextMenuY: 0,
      copiedContextRowId: false,
      contextCopyMessage: '',
    };
  },
  computed: {
    columnCount() {
      return (this.columns?.length || 0) + (this.selectable ? 1 : 0);
    },
    skeletonRowCount() {
      return Math.min(this.pageSize || 5, 5);
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
    contextMenuItems() {
      const identifier = this.contextRow ? this.rowIdentifier(this.contextRow, this.contextRowIndex) : '';
      return [
        { label: 'Open details', icon: 'mdi-open-in-new', action: 'open' },
        { label: this.copiedContextRowId ? 'Reference copied' : `Copy reference ${identifier}`, icon: this.copiedContextRowId ? 'mdi-check' : 'mdi-content-copy', action: 'copy' },
      ];
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
        'data-table-cell-truncate': Boolean(column.truncate),
      };
    },
    cellTitle(row, column) {
      if (!column.truncate) return undefined;
      const value = row[column.key];
      return value === undefined || value === null || value === '' ? undefined : String(value);
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
    openRowContextMenu(event, row, index) {
      this.contextRow = row;
      this.contextRowIndex = index;
      this.contextMenuX = event.clientX;
      this.contextMenuY = event.clientY;
      this.copiedContextRowId = false;
      this.$emit('row-context', { row, index, x: event.clientX, y: event.clientY });
    },
    closeRowContextMenu() {
      this.contextRow = null;
      this.contextRowIndex = -1;
      this.copiedContextRowId = false;
    },
    async handleRowContextAction(action) {
      const row = this.contextRow;
      const index = this.contextRowIndex;
      if (!row) return;
      if (action === 'open') {
        this.$emit('row-click', row);
        this.closeRowContextMenu();
        return;
      }
      if (action !== 'copy') return;
      const identifier = String(this.rowIdentifier(row, index));
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable');
        await navigator.clipboard.writeText(identifier);
        this.copiedContextRowId = true;
        this.contextCopyMessage = `Copied ${identifier}`;
        window.setTimeout(() => {
          this.contextCopyMessage = '';
        }, 2400);
      } catch (_) {
        this.copiedContextRowId = false;
        this.contextCopyMessage = 'Unable to copy the reference in this browser.';
        window.setTimeout(() => {
          this.contextCopyMessage = '';
        }, 2400);
      }
    },
    onRowKeydown(event, row, index) {
      if (event.target.closest('input, button, select, textarea, [contenteditable="true"]')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.$emit('row-click', row);
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const rows = Array.from(this.$el.querySelectorAll('.data-table-row'));
      const currentIndex = rows.indexOf(event.currentTarget);
      if (currentIndex < 0) return;
      const nextIndex = event.key === 'ArrowDown'
        ? Math.min(rows.length - 1, currentIndex + 1)
        : event.key === 'ArrowUp'
          ? Math.max(0, currentIndex - 1)
          : event.key === 'Home' ? 0 : rows.length - 1;
      rows[nextIndex]?.focus();
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
