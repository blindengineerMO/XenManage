const DataTable = {
  props: ['columns', 'data', 'loading', 'searchable'],
  emits: ['row-click'],
  template: `
    <div class="data-table-wrap">
      <div class="data-table-toolbar" v-if="searchable">
        <input class="data-table-search" placeholder="Search..." v-model="searchQuery" @input="page = 1">
        <span class="text-muted mono" style="font-size:11px">{{ filteredData.length }} records</span>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key"
                  :class="{ sorted: sortKey === column.key }"
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
              <td :colspan="columns.length" style="text-align:center;padding:24px">
                <span class="loading-spinner"></span>
              </td>
            </tr>
            <tr v-else-if="filteredData.length === 0">
              <td :colspan="columns.length" class="empty-state">
                <p>No data available</p>
              </td>
            </tr>
            <tr v-for="(row, index) in paginatedData" :key="row.ref || index" @click="$emit('row-click', row)">
              <td v-for="column in columns" :key="column.key">
                <slot :name="'cell-' + column.key" :row="row" :value="row[column.key]">
                  {{ row[column.key] }}
                </slot>
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
    };
  },
  computed: {
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
  },
  watch: {
    data() {
      this.page = 1;
    },
  },
  methods: {
    onSort(key) {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDir = 'asc';
      }
    },
  },
};

