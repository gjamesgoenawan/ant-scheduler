import { useState, useEffect } from "react";

import { API_URL } from "../../App";
import { fetchWithTimeout } from "../../utils/fetchWithTimeout";

function GpuToggleList({ data }) {
  const [enabled, setEnabled] = useState(() => data?.monitor?.gpu_allowed ?? []);

  // Sync with global data whenever it changes
  useEffect(() => {
    if (data?.monitor?.gpu_allowed) {
      setEnabled(data.monitor.gpu_allowed);
    }
  }, [data?.monitor?.gpu_allowed]);

  const toggleGpu = async (i) => {
    const newAllowed = !enabled[i];

    setEnabled((prev) =>
      prev.map((val, idx) => (idx === i ? newAllowed : val))
    );

    try {
      await fetchWithTimeout(`${API_URL}/toggle_allowed_gpu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gpu_indices: [i], allowed: newAllowed }),
      });
    } catch (err) {
      console.error("Failed to toggle GPU:", err);
      setEnabled((prev) =>
        prev.map((val, idx) => (idx === i ? !newAllowed : val))
      );
    }
  };

  const gpuNames = data?.monitor?.gpu_name || [];
  const gpuAvailability = data?.monitor?.gpu_availability || [];
  const enabledCount = enabled.filter(Boolean).length;

  return (
    <div className="dashboard-ops-panel dashboard-worker-panel">
      <div className="dashboard-ops-header">
        <div>
          <div className="dashboard-panel-eyebrow">Controls</div>
          <h6 className="dashboard-ops-title">Worker Status</h6>
        </div>
        <div className="dashboard-panel-kpis">
          <div className="dashboard-panel-kpi">
            <span className="dashboard-panel-kpi-label">Enabled</span>
            <span className="dashboard-panel-kpi-value">{enabledCount} / {gpuNames.length}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-worker-list">
        {gpuNames.map((name, i) => {
          const isAvailable = gpuAvailability[i] !== 0;
          const isEnabled = !!enabled[i];

          return (
            <div key={i} className="dashboard-worker-row">
              <div className="dashboard-worker-main">
                <span className={`dashboard-worker-dot ${isAvailable ? "dashboard-worker-dot-ready" : "dashboard-worker-dot-busy"}`}></span>

                <div className="dashboard-worker-copy">
                  <div className="dashboard-worker-name">{`GPU ${i} · ${name}`}</div>
                </div>
              </div>

              <div className="dashboard-worker-actions">
                <span className={`dashboard-worker-enabled ${isEnabled ? "dashboard-worker-enabled-on" : "dashboard-worker-enabled-off"}`}>
                  {isEnabled ? "Enabled" : "Disabled"}
                </span>

                <div className="form-check form-switch dashboard-worker-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`gpu-toggle-${i}`}
                    checked={isEnabled}
                    onChange={() => toggleGpu(i)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GpuToggleList;
