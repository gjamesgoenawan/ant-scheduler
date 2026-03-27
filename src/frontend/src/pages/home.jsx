import React, { useEffect, useRef, useState } from "react";
import Layout from "../components/layout/layout";
import TaskStatus from "../components/statistics/task_status";
import GpuToggleList from "../components/statistics/gpu_toggle";
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

function latestMetricValue(series, fallback = 0) {
  if (!Array.isArray(series) || series.length === 0) return fallback;
  const value = series[series.length - 1];
  return Number.isFinite(value) ? value : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
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
                                     borderColor: "rgba(255,255,255,0.8)", 
                                     fill: false,
                                     pointRadius: 0.0,
                                     borderWidth: 2 }] },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                }
            },
            interaction: {
              intersect: false,
              mode: 'index',
            },
            elements: {
                line: {
                    tension: 0.5 // Adjust this value for desired smoothness
                }
            },
            scales: {
            y: {
                min: 0,
                max: 100,
                grid: {
                drawBorder: false,
                display: true,
                drawOnChartArea: true,
                drawTicks: false,
                borderDash: [5, 5],
                color: 'rgba(255, 255, 255, .2)'
                },
                ticks: {
                display: true,
                color: '#f8f9fa',
                padding: 5,
                font: {
                    size: 12,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                },
                title: {
                display: true,
                text: 'Usage (%)',
                color: '#FFFFFF',
                font: {
                    size: 14,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                }
            },
            x: {
                grid: {
                drawBorder: false,
                display: false,
                drawOnChartArea: false,
                drawTicks: false,
                borderDash: [5, 5]
                },
                ticks : {
                display: false,
                },
            },
            },
        },
      });
    }

    if (!chartsRef.current.ram) {
      chartsRef.current.ram = new Chart(ramRef.current.getContext("2d"), {
        type: "line",
        data: { labels, datasets: [{ label: "RAM Usage", 
                                     data: monitor.ram_usage, 
                                     borderColor: "rgba(255,255,255,0.8)", 
                                     fill: false ,
                                     pointRadius: 0.0,
                                     borderWidth: 2 }] },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                }
            },
            interaction: {
              intersect: false,
              mode: 'index',
            },
            elements: {
                line: {
                    tension: 0.5 // Adjust this value for desired smoothness
                }
            },
            scales: {
            y: {
                min: 0,
                max: monitor.ram_total,
                grid: {
                drawBorder: false,
                display: true,
                drawOnChartArea: true,
                drawTicks: false,
                borderDash: [5, 5],
                color: 'rgba(255, 255, 255, .2)'
                },
                ticks: {
                display: true,
                color: '#f8f9fa',
                padding: 5,
                font: {
                    size: 12,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                },
                title: {
                display: true,
                text: 'RAM (GBs)',
                color: '#FFFFFF',
                font: {
                    size: 14,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                }
            },
            x: {
                grid: {
                drawBorder: false,
                display: false,
                drawOnChartArea: false,
                drawTicks: false,
                borderDash: [5, 5]
                },
                ticks : {
                display: false,
                },
            },
            },
        },
      });
    }

    if (!chartsRef.current.gpuUsage) {
      chartsRef.current.gpuUsage = new Chart(gpuUsageRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: monitor.gpu_usage.map((d, i) => ({ label: `GPU ${i}`, 
                                                       data: d, 
                                                       borderColor: "rgba(255,255,255,0.8)", 
                                                       fill: false,
                                                       pointRadius: 0.0,
                                                       borderWidth: 2 })),
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                  display: false,
              }
            },
            interaction: {
              intersect: false,
              mode: 'index',
            },
            elements: {
                line: {
                    tension: 0.5 // Adjust this value for desired smoothness
                }
            },
            scales: {
            y: {
                min: 0,
                max: 100,
                grid: {
                drawBorder: false,
                display: true,
                drawOnChartArea: true,
                drawTicks: false,
                borderDash: [5, 5],
                color: 'rgba(255, 255, 255, .2)'
                },
                ticks: {
                display: true,
                color: '#f8f9fa',
                padding: 5,
                font: {
                    size: 12,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                },
                title: {
                display: true,
                text: 'Usage (%)',
                color: '#FFFFFF',
                font: {
                    size: 14,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                }
            },
            x: {
                grid: {
                drawBorder: false,
                display: false,
                drawOnChartArea: false,
                drawTicks: false,
                borderDash: [5, 5]
                },
                ticks : {
                display: false,
                },
            },
            },
        },
      });
    }

    if (!chartsRef.current.gpuMemory) {
      chartsRef.current.gpuMemory = new Chart(gpuMemoryRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: monitor.gpu_memory.map((d, i) => ({ label: `GPU ${i}`, 
                                                        data: d, borderColor: "rgba(255,255,255,0.8)", 
                                                        fill: false, 
                                                        pointRadius: 0.0,
                                                        borderWidth: 2})),
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                line: {
                    tension: 0.5 // Adjust this value for desired smoothness
                }
            },
            plugins: {
                legend: {
                    display: false,
                }
            },
            interaction: {
              intersect: false,
              mode: 'index',
            },
            scales: {
            y: {
                min: 0,
                max: Math.max(...monitor.gpu_total_memory),
                grid: {
                drawBorder: false,
                display: true,
                drawOnChartArea: true,
                drawTicks: false,
                borderDash: [5, 5],
                color: 'rgba(255, 255, 255, .2)'
                },
                ticks: {
                display: true,
                color: '#f8f9fa',
                padding: 5,
                font: {
                    size: 12,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                },
                title: {
                display: true,
                text: 'Memory (GBs)',
                color: '#FFFFFF',
                font: {
                    size: 14,
                    weight: 300,
                    family: "Roboto",
                    style: 'normal',
                    lineHeight: 2
                },
                }
            },
            x: {
                grid: {
                drawBorder: false,
                display: false,
                drawOnChartArea: false,
                drawTicks: false,
                borderDash: [5, 5]
                },
                ticks : {
                display: false,
                },
            },
            },
        },
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

  return (
    <Layout pageTitle="Dashboard">
      <div className="container-fluid py-2 dashboard-page">
        {isMobileView ? (
          <div className="dashboard-mobile-shell">
            <div className="dashboard-mobile-card dashboard-mobile-hero">
              <div className="dashboard-mobile-eyebrow">System Overview</div>
              <div className="dashboard-mobile-title">
                {monitor ? `${monitor.cpu_count} cores · ${monitor.gpu_name?.length || 0} workers` : "Waiting for monitor data"}
              </div>
              <div className="dashboard-mobile-subtitle">
                {monitor ? monitor.cpu_name : "Connecting to backend..."}
              </div>
            </div>

            <div className="dashboard-mobile-card">
              <div className="dashboard-mobile-section-title">Compute</div>
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
              <div className="dashboard-mobile-section-title">GPU Overview</div>
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

            <div className="dashboard-mobile-card">
              <TaskStatus data={data} />
            </div>

            <div className="dashboard-mobile-card">
              <GpuToggleList data={data} />
            </div>
          </div>
        ) : (
        <>
        <div className="row mb-2">
          <div className="col-lg-6 col-md-6 mb-2 dashboard-desktop-col-left">
            <div className="card bg-gradient-primary dashboard-desktop-chart-card">
              <div className="card-header pb-0 bg-transparent">
                <h6 className="dashboard-desktop-card-title">
                  <div className="d-flex">
                    <div className="dashboard-desktop-card-icon">
                      <i className="material-icons opacity-10">memory</i>
                    </div>
                    <div>
                      {data?.monitor.cpu_count} Cores {data?.monitor.cpu_name}
                    </div>
                  </div>
                </h6>
              </div>
              <div className="card-body pt-1">
                <div className="row">
                  <div className="col-lg-6 col-md-6 mt-0 mb-2">
                    <div className="bg-transparent border-radius-lg py-3 pe-1">
                      <div className="chart dashboard-desktop-chart-shell">
                        <canvas ref={cpuRef}/>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6 col-md-6 mt-0 mb-2">
                    <div className="bg-transparent border-radius-lg py-3 pe-1">
                      <div className="chart dashboard-desktop-chart-shell">
                        <canvas ref={ramRef}/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6 col-md-6 mb-2 dashboard-desktop-col-right">
            <div className="card bg-gradient-secondary dashboard-desktop-chart-card">
              <div className="card-header pb-0 bg-transparent">
                <h6 className="dashboard-desktop-card-title">
                  <div className="d-flex">
                    <div className="dashboard-desktop-card-icon">
                      <i className="material-icons opacity-10">dns</i>
                    </div>
                    <div>
                      {data?.monitor.gpu_name.length} x {data?.monitor.gpu_name[0]} @ {data?.monitor.gpu_total_memory[0]}GB VRAM
                    </div>
                  </div>
                </h6>
              </div>
              <div className="card-body pt-1">
                <div className="row">
                  <div className="col-lg-6 col-md-6 mt-0 mb-2">
                    <div className="bg-transparent border-radius-lg py-3 pe-1">
                      <div className="chart dashboard-desktop-chart-shell">
                        <canvas ref={gpuUsageRef}/>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6 col-md-6 mt-0 mb-2">
                    <div className="bg-transparent border-radius-lg py-3 pe-1">
                      <div className="chart dashboard-desktop-chart-shell">
                        <canvas ref={gpuMemoryRef}/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row mb-2">
          <div className="col-lg-6 col-md-6 mb-2 dashboard-desktop-col-left dashboard-desktop-stat-col">
            <TaskStatus data={data}/>
          </div>
          <div className="col-lg-6 col-md-6 mb-2 dashboard-desktop-col-right dashboard-desktop-stat-col">
            <GpuToggleList data={data} /> 
          </div>
        </div>
        </>
        )}
      </div>
    </Layout>
  );
}
