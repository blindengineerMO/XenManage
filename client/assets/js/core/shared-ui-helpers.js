/* ============================================
   Shared UI Helpers
   ============================================ */

const windowManager = {
  zIndex: 550,
  next() {
    this.zIndex += 1;
    return this.zIndex;
  },
};

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatThroughput(kibPerSecond) {
  const value = Number(kibPerSecond || 0);
  if (!value) return '0 KiB/s';

  const units = ['KiB/s', 'MiB/s', 'GiB/s', 'TiB/s'];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function parseCalendarDate(value) {
  const source = String(value || '').trim();
  if (!source) return null;

  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffCalendarDays(from, to) {
  const left = startOfLocalDay(from).getTime();
  const right = startOfLocalDay(to).getTime();
  return Math.round((right - left) / 86400000);
}

function isTaskTerminal(task = {}) {
  const status = String(task.status || '').trim().toLowerCase();
  return ['success', 'warning', 'failure', 'cancelled', 'canceled', 'completed'].includes(status) || Boolean(task.finished);
}

function getTaskDueMeta(task = {}, options = {}) {
  const dueSoonDays = Number(options.dueSoonDays ?? 2);
  const agingWarningDays = Number(options.agingWarningDays ?? 3);
  const agingCriticalDays = Number(options.agingCriticalDays ?? 7);
  const createdAt = parseCalendarDate(task.created || task.updated_at || task.updatedAt || '');
  const dueAt = parseCalendarDate(task.due_date || task.dueDate || '');
  const today = startOfLocalDay(new Date());
  const ageDays = createdAt ? Math.max(0, diffCalendarDays(createdAt, today)) : null;
  const ageLabel = ageDays === null
    ? 'Unknown age'
    : ageDays === 0
      ? 'New today'
      : `${ageDays}d in queue`;

  if (isTaskTerminal(task)) {
    return {
      bucket: 'closed',
      tone: 'success',
      label: 'Closed',
      detail: task.finished ? `Finished ${formatDateTime(task.finished)}` : 'Task is in a terminal state.',
      ageDays,
      ageLabel,
      dueDate: dueAt ? formatDateTime(dueAt) : '',
      isClosed: true,
      isOverdue: false,
      isDueSoon: false,
      isAging: false,
    };
  }

  if (dueAt) {
    const daysUntilDue = diffCalendarDays(today, dueAt);

    if (daysUntilDue < 0) {
      return {
        bucket: 'overdue',
        tone: 'critical',
        label: `Overdue ${Math.abs(daysUntilDue)}d`,
        detail: `Target was ${String(task.due_date || task.dueDate || '').trim()}.`,
        ageDays,
        ageLabel,
        dueDate: String(task.due_date || task.dueDate || '').trim(),
        isClosed: false,
        isOverdue: true,
        isDueSoon: false,
        isAging: true,
      };
    }

    if (daysUntilDue === 0) {
      return {
        bucket: 'today',
        tone: 'warning',
        label: 'Due today',
        detail: `Target date is ${String(task.due_date || task.dueDate || '').trim()}.`,
        ageDays,
        ageLabel,
        dueDate: String(task.due_date || task.dueDate || '').trim(),
        isClosed: false,
        isOverdue: false,
        isDueSoon: true,
        isAging: ageDays !== null && ageDays >= agingWarningDays,
      };
    }

    if (daysUntilDue <= dueSoonDays) {
      return {
        bucket: 'soon',
        tone: 'warning',
        label: `Due in ${daysUntilDue}d`,
        detail: `Target date is ${String(task.due_date || task.dueDate || '').trim()}.`,
        ageDays,
        ageLabel,
        dueDate: String(task.due_date || task.dueDate || '').trim(),
        isClosed: false,
        isOverdue: false,
        isDueSoon: true,
        isAging: ageDays !== null && ageDays >= agingWarningDays,
      };
    }

    return {
      bucket: 'scheduled',
      tone: 'info',
      label: `Due in ${daysUntilDue}d`,
      detail: `Target date is ${String(task.due_date || task.dueDate || '').trim()}.`,
      ageDays,
      ageLabel,
      dueDate: String(task.due_date || task.dueDate || '').trim(),
      isClosed: false,
      isOverdue: false,
      isDueSoon: false,
      isAging: false,
    };
  }

  if (ageDays !== null && ageDays >= agingCriticalDays) {
    return {
      bucket: 'aging-critical',
      tone: 'critical',
      label: `Aging ${ageDays}d`,
      detail: 'No due date is assigned and this remediation is now stale.',
      ageDays,
      ageLabel,
      dueDate: '',
      isClosed: false,
      isOverdue: false,
      isDueSoon: false,
      isAging: true,
    };
  }

  if (ageDays !== null && ageDays >= agingWarningDays) {
    return {
      bucket: 'aging-warning',
      tone: 'warning',
      label: `Aging ${ageDays}d`,
      detail: 'No due date is assigned, so ownership and closure timing should be reviewed.',
      ageDays,
      ageLabel,
      dueDate: '',
      isClosed: false,
      isOverdue: false,
      isDueSoon: false,
      isAging: true,
    };
  }

  return {
    bucket: 'fresh',
    tone: 'info',
    label: ageDays === 0 ? 'New today' : (ageDays === null ? 'No due date' : `${ageDays}d old`),
    detail: dueAt ? `Target date is ${String(task.due_date || task.dueDate || '').trim()}.` : 'No due date assigned yet.',
    ageDays,
    ageLabel,
    dueDate: '',
    isClosed: false,
    isOverdue: false,
    isDueSoon: false,
    isAging: false,
  };
}

function getTaskSlaBadgeClass(meta = {}) {
  if (meta.tone === 'critical') return 'badge-error';
  if (meta.tone === 'warning') return 'badge-warning';
  if (meta.tone === 'success') return 'badge-success';
  return 'badge-info';
}

function truncateList(value) {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.slice(0, 4).join(', ');
}

function summarizeCount(label, value) {
  return `${value || 0} ${label}`;
}

function getMessageHeadline(message) {
  return message?.summary || message?.name || message?.body || message?.cls || 'Alert';
}

function getMessageSeverity(message) {
  const explicit = String(message?.effectiveSeverity || message?.severity || '').toLowerCase();
  if (['critical', 'warning', 'info', 'notice'].includes(explicit)) {
    return explicit;
  }

  const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();

  if (/(critical|fatal|failed|failure|panic|error|offline|down|corrupt|exhausted|unavailable)/.test(haystack)) {
    return 'critical';
  }

  if (/(warn|warning|degraded|threshold|latency|retry|paused|stopped|maintenance|high)/.test(haystack)) {
    return 'warning';
  }

  if (/(resolved|healthy|restored|recovered|success|info|notice)/.test(haystack)) {
    return 'info';
  }

  return 'notice';
}

function sortMessages(messages) {
  const severityOrder = { critical: 0, warning: 1, info: 2, notice: 3 };

  return [...(messages || [])].sort((left, right) => {
    const severityDelta = (severityOrder[getMessageSeverity(left)] ?? 99) - (severityOrder[getMessageSeverity(right)] ?? 99);
    if (severityDelta !== 0) return severityDelta;
    return new Date(right.timestamp || 0) - new Date(left.timestamp || 0);
  });
}
