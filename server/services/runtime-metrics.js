const requestTotals = new Map();
let requestDurationSeconds = 0;

function recordRequest({ method, statusCode, durationMs }) {
  const key = `${method}:${Math.floor(Number(statusCode || 0) / 100)}xx`;
  requestTotals.set(key, (requestTotals.get(key) || 0) + 1);
  requestDurationSeconds += Math.max(0, Number(durationMs || 0)) / 1000;
}

function renderPrometheusMetrics({ workflowDepth = 0, managedTargets = {} } = {}) {
  const lines = [
    '# HELP xenmanage_http_requests_total Completed HTTP requests by method and status class.',
    '# TYPE xenmanage_http_requests_total counter',
  ];
  for (const [key, value] of requestTotals.entries()) {
    const [method, statusClass] = key.split(':');
    lines.push(`xenmanage_http_requests_total{method="${method}",status_class="${statusClass}"} ${value}`);
  }
  lines.push('# HELP xenmanage_http_request_duration_seconds_total Total completed HTTP request duration.');
  lines.push('# TYPE xenmanage_http_request_duration_seconds_total counter');
  lines.push(`xenmanage_http_request_duration_seconds_total ${requestDurationSeconds.toFixed(6)}`);
  lines.push('# HELP xenmanage_workflow_queue_depth Active queued or running workflows.');
  lines.push('# TYPE xenmanage_workflow_queue_depth gauge');
  lines.push(`xenmanage_workflow_queue_depth ${workflowDepth}`);
  lines.push('# HELP xenmanage_managed_targets Managed Xen targets by health state.');
  lines.push('# TYPE xenmanage_managed_targets gauge');
  lines.push(`xenmanage_managed_targets{state="enabled"} ${Number(managedTargets.enabled || 0)}`);
  lines.push(`xenmanage_managed_targets{state="healthy"} ${Number(managedTargets.healthy || 0)}`);
  lines.push(`xenmanage_managed_targets{state="unhealthy"} ${Number(managedTargets.unhealthy || 0)}`);
  return `${lines.join('\n')}\n`;
}

module.exports = { recordRequest, renderPrometheusMetrics };
