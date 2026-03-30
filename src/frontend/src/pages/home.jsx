import React, { useEffect, useRef, useState } from "react";
import Layout from "../components/layout/layout";
import TaskStatus from "../components/statistics/task_status";
import GpuToggleList from "../components/statistics/gpu_toggle";
import { getTaskSummary } from "../utils/taskSummary";
import { useMonitorData } from "../App";

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);

const GPU_LINE_COLORS = [
  "#7dd3fc",
  "#c4b5fd",
  "#f9a8d4",
  "#86efac",
  "#fcd34d",
  "#fb7185",
];
const CHART_GRID_COLOR = "rgba(148, 163, 184, 0.24)";
const CHART_TICK_COLOR = "#64748b";
const CHART_TITLE_COLOR = "#334155";
const CHART_CPU_COLOR = "#742191";
const CHART_RAM_COLOR = "#8b5cf6";

function latestMetricValue(series, fallback = 0) {
  if (!Array.isArray(series) || series.length === 0) return fallback;
  const value = series[series.length - 1];
  return Number.isFinite(value) ? value : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function simplifyGpuName(name) {
  if (!name) return "";

  return name
    .replace(/^nvidia\s+/i, "")
    .replace(/^geforce\s+/i, "")
    .replace(/^quadro\s+/i, "")
    .replace(/^rtx\s+/i, "")
    .trim();
}

function formatGpuFleetSummary(names) {
  if (!Array.isArray(names) || names.length === 0) return "No GPU workers detected";

  const normalizedNames = names.map((name) => String(name).trim()).filter(Boolean);
  if (normalizedNames.length === 0) return "No GPU workers detected";

  const counts = normalizedNames.reduce((acc, name) => {
    acc.set(name, (acc.get(name) || 0) + 1);
    return acc;
  }, new Map());

  if (counts.size === 1) {
    const [name] = counts.keys();
    return `${normalizedNames.length}x ${name}`;
  }

  return Array.from(counts.entries())
    .map(([name, count]) => `${count}x ${simplifyGpuName(name) || name}`)
    .join(" · ");
}

function buildLineChartOptions({ min = 0, max, title }) {
  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
    elements: {
      line: {
        tension: 0.5,
      },
    },
    scales: {
      y: {
        min,
        max,
        grid: {
          drawBorder: false,
          display: true,
          drawOnChartArea: true,
          drawTicks: false,
          borderDash: [5, 5],
          color: CHART_GRID_COLOR,
        },
        ticks: {
          display: true,
          color: CHART_TICK_COLOR,
          padding: 5,
          font: {
            size: 12,
            weight: 400,
            family: "Roboto",
            style: "normal",
            lineHeight: 2,
          },
        },
        title: {
          display: true,
          text: title,
          color: CHART_TITLE_COLOR,
          font: {
            size: 13,
            weight: 500,
            family: "Roboto",
            style: "normal",
            lineHeight: 2,
          },
        },
      },
      x: {
        grid: {
          drawBorder: false,
          display: false,
          drawOnChartArea: false,
          drawTicks: false,
          borderDash: [5, 5],
        },
        ticks: {
          display: false,
        },
      },
    },
  };
}

function MobileMetricBar({ label, valueText, percent, tone = "primary" }) {
  return (
    <div className="mobile-metric-row">
      <div className="d-flex justify-content-between align-items-end gap-3 mb-2">
        <div className="mobile-metric-label">{label}</div>
        <div className="mobile-metric-value">{valueText}</div>
      </div>
      <div className="mobile-metric-track">
        <div
          className={`mobile-metric-fill mobile-metric-fill-${tone}`}
          style={{ width: `${clampPercent(percent)}%` }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const { data } = useMonitorData(); 
  const [isMobileView, setIsMobileView] = useState(false);

  const cpuRef = useRef(null);
  const ramRef = useRef(null);
  const gpuUsageRef = useRef(null);
  const gpuMemoryRef = useRef(null);

  const chartsRef = useRef({
    cpu: null,
    ram: null,
    gpuUsage: null,
    gpuMemory: null,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767.98px)");

    const syncMobileState = (event) => {
      setIsMobileView(event.matches);
    };

    syncMobileState(mediaQuery);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncMobileState);
      return () => mediaQuery.removeEventListener("change", syncMobileState);
    }

    mediaQuery.addListener(syncMobileState);
    return () => mediaQuery.removeListener(syncMobileState);
  }, []);

  // Create charts only once
  useEffect(() => {
    if (!data || isMobileView) return;
    const monitor = data.monitor;
    const labels = Array.from({ length: monitor.cpu_usage.length }, (_, idx) => `${monitor.cpu_usage.length - idx} seconds ago`);

    if (!chartsRef.current.cpu) {
      chartsRef.current.cpu = new Chart(cpuRef.current.getContext("2d"), {
        type: "line",
        data: { labels, datasets: [{ label: "CPU Usage", 
                                     data: monitor.cpu_usage, 
                                     borderColor: CHART_CPU_COLOR, 
                                     fill: false,
                                     pointRadius: 0.0,
                                     borderWidth: 2 }] },
        options: buildLineChartOptions({ max: 100, title: "Usage (%)" }),
      });
    }

    if (!chartsRef.current.ram) {
      chartsRef.current.ram = new Chart(ramRef.current.getContext("2d"), {
        type: "line",
        data: { labels, datasets: [{ label: "RAM Usage", 
                                     data: monitor.ram_usage, 
                                     borderColor: CHART_RAM_COLOR, 
                                     fill: false ,
                                     pointRadius: 0.0,
                                     borderWidth: 2 }] },
        options: buildLineChartOptions({ max: monitor.ram_total, title: "Usage (GB)" }),
      });
    }

    if (!chartsRef.current.gpuUsage) {
      chartsRef.current.gpuUsage = new Chart(gpuUsageRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: monitor.gpu_usage.map((d, i) => ({ label: `GPU ${i}`, 
                                                       data: d, 
                                                       borderColor: GPU_LINE_COLORS[i % GPU_LINE_COLORS.length], 
                                                       fill: false,
                                                       pointRadius: 0.0,
                                                       borderWidth: 2 })),
        },
        options: buildLineChartOptions({ max: 100, title: "Usage (%)" }),
      });
    }

    if (!chartsRef.current.gpuMemory) {
      chartsRef.current.gpuMemory = new Chart(gpuMemoryRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: monitor.gpu_memory.map((d, i) => ({ label: `GPU ${i}`, 
                                                        data: d, borderColor: GPU_LINE_COLORS[i % GPU_LINE_COLORS.length], 
                                                        fill: false, 
                                                        pointRadius: 0.0,
                                                        borderWidth: 2})),
        },
        options: buildLineChartOptions({ max: Math.max(...monitor.gpu_total_memory), title: "Usage (GB)" }),
      });
    }
  }, [data, isMobileView]);

  // Update charts in place when new data comes in
  useEffect(() => {
    if (!data || isMobileView) return;
    const monitor = data.monitor;

    const updateChart = (chart, datasets) => {
      chart.data.datasets.forEach((d, i) => {
        if (datasets[i]) d.data = datasets[i].data;
      });
      chart.update();
    };

    if (chartsRef.current.cpu) updateChart(chartsRef.current.cpu, [{ data: monitor.cpu_usage }]);
    if (chartsRef.current.ram) updateChart(chartsRef.current.ram, [{ data: monitor.ram_usage }]);
    if (chartsRef.current.gpuUsage)
      updateChart(
        chartsRef.current.gpuUsage,
        monitor.gpu_usage.map((d) => ({ data: d }))
      );
    if (chartsRef.current.gpuMemory)
      updateChart(
        chartsRef.current.gpuMemory,
        monitor.gpu_memory.map((d) => ({ data: d }))
      );
  }, [data, isMobileView]);

  const monitor = data?.monitor;
  const cpuUsage = latestMetricValue(monitor?.cpu_usage, 0);
  const ramUsage = latestMetricValue(monitor?.ram_usage, 0);
  const ramTotal = monitor?.ram_total || 0;
  const ramUsagePercent = ramTotal > 0 ? (ramUsage / ramTotal) * 100 : 0;
  const taskSummary = getTaskSummary(data);
  const queuedCount = taskSummary.queued;
  const runningCount = taskSummary.running;
  const completedCount = taskSummary.completed;
  const gpuCards = (monitor?.gpu_name || []).map((name, index) => {
    const gpuUsage = latestMetricValue(monitor?.gpu_usage?.[index], 0);
    const gpuMemory = latestMetricValue(monitor?.gpu_memory?.[index], 0);
    const gpuMemoryTotal = monitor?.gpu_total_memory?.[index] || 0;

    return {
      name,
      index,
      gpuUsage,
      gpuMemory,
      gpuMemoryTotal,
      usagePercent: gpuUsage,
      memoryPercent: gpuMemoryTotal > 0 ? (gpuMemory / gpuMemoryTotal) * 100 : 0,
    };
  });
  const gpuEnabledCount = (monitor?.gpu_allowed || []).filter(Boolean).length;
  const gpuReadyCount = (monitor?.gpu_availability || []).filter((value) => value !== 0).length;
  const totalVram = (monitor?.gpu_total_memory || []).reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0
  );
  const gpuFleetSummary = formatGpuFleetSummary(monitor?.gpu_name || []);

  return (
    <Layout pageTitle="Dashboard">
      <div className="container-fluid py-2 dashboard-page">
        {isMobileView ? (
          <div className="dashboard-mobile-shell">
            <div className="dashboard-mobile-card dashboard-mobile-card-compute">
              <div className="dashboard-mobile-card-header">
                <div className="dashboard-mobile-card-eyebrow">Compute</div>
                <div className="dashboard-mobile-card-title">CPU &amp; Memory</div>
                <div className="dashboard-mobile-card-subtitle">
                  {monitor ? `${monitor.cpu_count} Cores - ${monitor.cpu_name}` : "Connecting to backend..."}
                </div>
              </div>
              <div className="dashboard-mobile-metrics">
                <MobileMetricBar
                  label="CPU Usage"
                  valueText={`${cpuUsage.toFixed(1)}%`}
                  percent={cpuUsage}
                  tone="primary"
                />
                <MobileMetricBar
                  label="RAM Usage"
                  valueText={`${ramUsage.toFixed(1)} / ${ramTotal.toFixed(1)} GB`}
                  percent={ramTotal > 0 ? (ramUsage / ramTotal) * 100 : 0}
                  tone="info"
                />
              </div>
            </div>

            <div className="dashboard-mobile-card">
              <div className="dashboard-mobile-section-header">
                <div>
                  <div className="dashboard-mobile-card-eyebrow">Workers</div>
                  <div className="dashboard-mobile-card-title">GPU Fleet</div>
                  <div className="dashboard-mobile-card-subtitle">
                    {gpuCards.length > 0
                      ? `${gpuEnabledCount} enabled ${gpuReadyCount} ready`
                      : "No GPU workers detected"}
                  </div>
                </div>
                <div className="dashboard-panel-kpis">
                  <div className="dashboard-panel-kpi">
                    <span className="dashboard-panel-kpi-label">Ready</span>
                    <span className="dashboard-panel-kpi-value">{gpuReadyCount}</span>
                  </div>
                </div>
              </div>
              <div className="dashboard-mobile-gpu-groups">
                <div className="dashboard-mobile-gpu-group">
                  <div className="dashboard-mobile-gpu-group-title">Utilization</div>
                  <div className="dashboard-mobile-gpu-list">
                    {gpuCards.map((gpu) => (
                      <MobileMetricBar
                        key={`gpu-usage-${gpu.index}`}
                        label={`gpu ${gpu.index} (${gpu.name})`}
                        valueText={`${gpu.gpuUsage.toFixed(1)}%`}
                        percent={gpu.usagePercent}
                        tone="secondary"
                      />
                    ))}
                  </div>
                </div>

                <div className="dashboard-mobile-gpu-group">
                  <div className="dashboard-mobile-gpu-group-title">Memory</div>
                  <div className="dashboard-mobile-gpu-list">
                    {gpuCards.map((gpu) => (
                      <MobileMetricBar
                        key={`gpu-memory-${gpu.index}`}
                        label={`gpu ${gpu.index} (${gpu.name})`}
                        valueText={`${gpu.gpuMemory.toFixed(1)} / ${gpu.gpuMemoryTotal} GB`}
                        percent={gpu.memoryPercent}
                        tone="warning"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <TaskStatus data={data} />

            <GpuToggleList data={data} />
          </div>
        ) : (
        <>
        <div className="dashboard-overview-grid mb-3">
          <div className="dashboard-overview-card dashboard-overview-card-compute">
            <div className="dashboard-overview-copy">
              <div className="dashboard-overview-label">CPU</div>
              <div className="dashboard-overview-value">{cpuUsage.toFixed(1)}%</div>
              <div className="dashboard-overview-meta">{monitor?.cpu_count || 0} cores online</div>
            </div>
          </div>

          <div className="dashboard-overview-card dashboard-overview-card-memory">
            <div className="dashboard-overview-copy">
              <div className="dashboard-overview-label">RAM</div>
              <div className="dashboard-overview-value">{ramUsage.toFixed(1)} / {ramTotal.toFixed(1)} GB</div>
              <div className="dashboard-overview-meta">{ramUsagePercent.toFixed(0)}% in use</div>
            </div>
          </div>

          <div className="dashboard-overview-card dashboard-overview-card-workers">
            <div className="dashboard-overview-copy">
              <div className="dashboard-overview-label">Workers</div>
              <div className="dashboard-overview-value">{gpuReadyCount} ready</div>
              <div className="dashboard-overview-meta">{gpuEnabledCount} enabled · {totalVram} GB VRAM</div>
            </div>
          </div>

          <div className="dashboard-overview-card dashboard-overview-card-tasks">
            <div className="dashboard-overview-copy">
              <div className="dashboard-overview-label">Tasks</div>
              <div className="dashboard-overview-value">{runningCount} running</div>
              <div className="dashboard-overview-meta">{queuedCount} queued · {completedCount} completed</div>
            </div>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-lg-6 mb-3 mb-lg-0">
            <div className="dashboard-history-panel dashboard-history-panel-compute">
              <div className="dashboard-history-header">
                <div>
                  <div className="dashboard-panel-eyebrow">System</div>
                  <h5 className="dashboard-panel-title">Processor</h5>
                  <div className="dashboard-panel-subtitle">
                    {monitor ? `${monitor.cpu_count} cores · ${monitor.cpu_name}` : "Waiting for monitor data"}
                  </div>
                </div>
                <div className="dashboard-panel-kpis">
                  <div className="dashboard-panel-kpi">
                    <span className="dashboard-panel-kpi-label">Live</span>
                    <span className="dashboard-panel-kpi-value">{cpuUsage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-chart-card dashboard-chart-card-compute">
                <div className="dashboard-chart-card-header">
                  <div>
                    <div className="dashboard-chart-card-label">CPU Utilization</div>
                    <div className="dashboard-chart-card-meta">Overall utilization history</div>
                  </div>
                  <div className="dashboard-chart-card-live">{cpuUsage.toFixed(1)}%</div>
                </div>
                <div className="chart dashboard-chart-canvas">
                  <canvas ref={cpuRef}/>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="dashboard-history-panel dashboard-history-panel-compute">
              <div className="dashboard-history-header">
                <div>
                  <div className="dashboard-panel-eyebrow">System</div>
                  <h5 className="dashboard-panel-title">Memory</h5>
                  <div className="dashboard-panel-subtitle">
                    {monitor ? `${ramTotal.toFixed(1)} GB total system memory` : "Waiting for monitor data"}
                  </div>
                </div>
                <div className="dashboard-panel-kpis">
                  <div className="dashboard-panel-kpi">
                    <span className="dashboard-panel-kpi-label">Live</span>
                    <span className="dashboard-panel-kpi-value">{ramUsage.toFixed(1)} / {ramTotal.toFixed(1)} GB</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-chart-card dashboard-chart-card-compute-alt">
                <div className="dashboard-chart-card-header">
                  <div>
                    <div className="dashboard-chart-card-label">RAM Utilization</div>
                    <div className="dashboard-chart-card-meta">Overall utilization</div>
                  </div>
                  <div className="dashboard-chart-card-live">{ramUsagePercent.toFixed(0)}%</div>
                </div>
                <div className="chart dashboard-chart-canvas">
                  <canvas ref={ramRef}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-lg-6 mb-3 mb-lg-0">
            <div className="dashboard-history-panel dashboard-history-panel-gpu">
              <div className="dashboard-history-header">
                <div>
                  <div className="dashboard-panel-eyebrow">Workers</div>
                  <h5 className="dashboard-panel-title">GPU Fleet</h5>
                  <div className="dashboard-panel-subtitle">
                    {gpuCards.length > 0
                      ? `${gpuFleetSummary} · ${gpuEnabledCount} enabled · ${gpuReadyCount} ready`
                      : "No GPU workers detected"}
                  </div>
                </div>
                <div className="dashboard-panel-kpis">
                  <div className="dashboard-panel-kpi">
                    <span className="dashboard-panel-kpi-label">Ready</span>
                    <span className="dashboard-panel-kpi-value">{gpuReadyCount}</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-chart-grid dashboard-chart-grid-gpu">
                <div className="dashboard-chart-card dashboard-chart-card-gpu">
                  <div className="dashboard-chart-card-header">
                    <div>
                      <div className="dashboard-chart-card-label">GPU Utilization</div>
                      <div className="dashboard-chart-card-meta">Per-worker compute load</div>
                    </div>
                  </div>
                  <div className="chart dashboard-chart-canvas">
                    <canvas ref={gpuUsageRef}/>
                  </div>
                </div>

                <div className="dashboard-chart-card dashboard-chart-card-gpu-alt">
                  <div className="dashboard-chart-card-header">
                    <div>
                      <div className="dashboard-chart-card-label">GPU Memory Utilization</div>
                      <div className="dashboard-chart-card-meta">Per-worker memory footprint</div>
                    </div>
                  </div>
                  <div className="chart dashboard-chart-canvas">
                    <canvas ref={gpuMemoryRef}/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="dashboard-side-stack">
              <div className="dashboard-task-stack-item">
                <TaskStatus data={data} />
              </div>
              <div className="dashboard-worker-stack-item">
                <GpuToggleList data={data} />
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </Layout>
  );
}
