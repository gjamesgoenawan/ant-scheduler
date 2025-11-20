import React, { useEffect, useRef, useState } from "react";
import Layout, { useToast } from "../components/layout/layout";
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

export default function Home() {

  Array.prototype.max = function() {
    return Math.max.apply(null, this);
  };

  Array.prototype.min = function() {
    return Math.min.apply(null, this);
  };
  const { data } = useMonitorData(); 
  const [setData] = useState(null);

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

  // Create charts only once
  useEffect(() => {
    
    if (!data) return;
    const monitor = data.monitor;
    const labels = ['300 seconds ago', '299 seconds ago', '298 seconds ago', '297 seconds ago', '296 seconds ago', '295 seconds ago', '294 seconds ago', '293 seconds ago', '292 seconds ago', '291 seconds ago', '290 seconds ago', '289 seconds ago', '288 seconds ago', '287 seconds ago', '286 seconds ago', '285 seconds ago', '284 seconds ago', '283 seconds ago', '282 seconds ago', '281 seconds ago', '280 seconds ago', '279 seconds ago', '278 seconds ago', '277 seconds ago', '276 seconds ago', '275 seconds ago', '274 seconds ago', '273 seconds ago', '272 seconds ago', '271 seconds ago', '270 seconds ago', '269 seconds ago', '268 seconds ago', '267 seconds ago', '266 seconds ago', '265 seconds ago', '264 seconds ago', '263 seconds ago', '262 seconds ago', '261 seconds ago', '260 seconds ago', '259 seconds ago', '258 seconds ago', '257 seconds ago', '256 seconds ago', '255 seconds ago', '254 seconds ago', '253 seconds ago', '252 seconds ago', '251 seconds ago', '250 seconds ago', '249 seconds ago', '248 seconds ago', '247 seconds ago', '246 seconds ago', '245 seconds ago', '244 seconds ago', '243 seconds ago', '242 seconds ago', '241 seconds ago', '240 seconds ago', '239 seconds ago', '238 seconds ago', '237 seconds ago', '236 seconds ago', '235 seconds ago', '234 seconds ago', '233 seconds ago', '232 seconds ago', '231 seconds ago', '230 seconds ago', '229 seconds ago', '228 seconds ago', '227 seconds ago', '226 seconds ago', '225 seconds ago', '224 seconds ago', '223 seconds ago', '222 seconds ago', '221 seconds ago', '220 seconds ago', '219 seconds ago', '218 seconds ago', '217 seconds ago', '216 seconds ago', '215 seconds ago', '214 seconds ago', '213 seconds ago', '212 seconds ago', '211 seconds ago', '210 seconds ago', '209 seconds ago', '208 seconds ago', '207 seconds ago', '206 seconds ago', '205 seconds ago', '204 seconds ago', '203 seconds ago', '202 seconds ago', '201 seconds ago', '200 seconds ago', '199 seconds ago', '198 seconds ago', '197 seconds ago', '196 seconds ago', '195 seconds ago', '194 seconds ago', '193 seconds ago', '192 seconds ago', '191 seconds ago', '190 seconds ago', '189 seconds ago', '188 seconds ago', '187 seconds ago', '186 seconds ago', '185 seconds ago', '184 seconds ago', '183 seconds ago', '182 seconds ago', '181 seconds ago', '180 seconds ago', '179 seconds ago', '178 seconds ago', '177 seconds ago', '176 seconds ago', '175 seconds ago', '174 seconds ago', '173 seconds ago', '172 seconds ago', '171 seconds ago', '170 seconds ago', '169 seconds ago', '168 seconds ago', '167 seconds ago', '166 seconds ago', '165 seconds ago', '164 seconds ago', '163 seconds ago', '162 seconds ago', '161 seconds ago', '160 seconds ago', '159 seconds ago', '158 seconds ago', '157 seconds ago', '156 seconds ago', '155 seconds ago', '154 seconds ago', '153 seconds ago', '152 seconds ago', '151 seconds ago', '150 seconds ago', '149 seconds ago', '148 seconds ago', '147 seconds ago', '146 seconds ago', '145 seconds ago', '144 seconds ago', '143 seconds ago', '142 seconds ago', '141 seconds ago', '140 seconds ago', '139 seconds ago', '138 seconds ago', '137 seconds ago', '136 seconds ago', '135 seconds ago', '134 seconds ago', '133 seconds ago', '132 seconds ago', '131 seconds ago', '130 seconds ago', '129 seconds ago', '128 seconds ago', '127 seconds ago', '126 seconds ago', '125 seconds ago', '124 seconds ago', '123 seconds ago', '122 seconds ago', '121 seconds ago', '120 seconds ago', '119 seconds ago', '118 seconds ago', '117 seconds ago', '116 seconds ago', '115 seconds ago', '114 seconds ago', '113 seconds ago', '112 seconds ago', '111 seconds ago', '110 seconds ago', '109 seconds ago', '108 seconds ago', '107 seconds ago', '106 seconds ago', '105 seconds ago', '104 seconds ago', '103 seconds ago', '102 seconds ago', '101 seconds ago', '100 seconds ago', '99 seconds ago', '98 seconds ago', '97 seconds ago', '96 seconds ago', '95 seconds ago', '94 seconds ago', '93 seconds ago', '92 seconds ago', '91 seconds ago', '90 seconds ago', '89 seconds ago', '88 seconds ago', '87 seconds ago', '86 seconds ago', '85 seconds ago', '84 seconds ago', '83 seconds ago', '82 seconds ago', '81 seconds ago', '80 seconds ago', '79 seconds ago', '78 seconds ago', '77 seconds ago', '76 seconds ago', '75 seconds ago', '74 seconds ago', '73 seconds ago', '72 seconds ago', '71 seconds ago', '70 seconds ago', '69 seconds ago', '68 seconds ago', '67 seconds ago', '66 seconds ago', '65 seconds ago', '64 seconds ago', '63 seconds ago', '62 seconds ago', '61 seconds ago', '60 seconds ago', '59 seconds ago', '58 seconds ago', '57 seconds ago', '56 seconds ago', '55 seconds ago', '54 seconds ago', '53 seconds ago', '52 seconds ago', '51 seconds ago', '50 seconds ago', '49 seconds ago', '48 seconds ago', '47 seconds ago', '46 seconds ago', '45 seconds ago', '44 seconds ago', '43 seconds ago', '42 seconds ago', '41 seconds ago', '40 seconds ago', '39 seconds ago', '38 seconds ago', '37 seconds ago', '36 seconds ago', '35 seconds ago', '34 seconds ago', '33 seconds ago', '32 seconds ago', '31 seconds ago', '30 seconds ago', '29 seconds ago', '28 seconds ago', '27 seconds ago', '26 seconds ago', '25 seconds ago', '24 seconds ago', '23 seconds ago', '22 seconds ago', '21 seconds ago', '20 seconds ago', '19 seconds ago', '18 seconds ago', '17 seconds ago', '16 seconds ago', '15 seconds ago', '14 seconds ago', '13 seconds ago', '12 seconds ago', '11 seconds ago', '10 seconds ago', '9 seconds ago', '8 seconds ago', '7 seconds ago', '6 seconds ago', '5 seconds ago', '4 seconds ago', '3 seconds ago', '2 seconds ago', '1 seconds ago']

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
                max: monitor.gpu_total_memory.max(),
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
  }, [data]);

  // Update charts in place when new data comes in
  useEffect(() => {
    if (!data) return;
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
  }, [data]);

  return (
    <Layout pageTitle="Dashboard">
      <div className="container-fluid py-2">
        <div className="row mb-2">
          <div className="col-lg-6 col-md-6 mb-2"
            style={{ paddingLeft: 0,
                     paddingRight: '6px',}}>
            <div className="card bg-gradient-primary" style={{ height: '100%' }}>
              <div className="card-header pb-0 bg-transparent">
                <h6 style={{ color: "#FFF" }}>
                  <div className="d-flex">
                    <div  style={{ 
                      marginTop: "2px",
                      marginRight: "6px"
                    }}>
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
                      <div className="chart" style={{ height: "200px" }}>
                        <canvas ref={cpuRef}/>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6 col-md-6 mt-0 mb-2">
                    <div className="bg-transparent border-radius-lg py-3 pe-1">
                      <div className="chart" style={{ height: "200px" }}>
                        <canvas ref={ramRef}/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6 col-md-6 mb-2"
            style={{ paddingLeft: '6px',
                     paddingRight: 0,}}>
            <div className="card bg-gradient-secondary" style={{ height: '100%' }}>
              <div className="card-header pb-0 bg-transparent">
                <h6 style={{ color: "#FFF" }}>
                  <div className="d-flex">
                    <div  style={{ 
                      marginTop: "2px",
                      marginRight: "6px"
                    }}>
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
                      <div className="chart" style={{ height: "200px" }}>
                        <canvas ref={gpuUsageRef}/>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6 col-md-6 mt-0 mb-2">
                    <div className="bg-transparent border-radius-lg py-3 pe-1">
                      <div className="chart" style={{ height: "200px" }}>
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
          <div className="col-lg-6 col-md-6 mb-2"
            style={{ paddingLeft: '0px',
                     paddingRight: '6px',
                     height: '250px'}}>
            <TaskStatus data={data}/>
          </div>
          <div className="col-lg-6 col-md-6 mb-2"
            style={{ paddingLeft: '6px',
                     paddingRight: '0px',
                     maxHeight: '250px'}}>
            <GpuToggleList data={data} /> 
          </div>
        </div>
      </div>
    </Layout>
  );
}
