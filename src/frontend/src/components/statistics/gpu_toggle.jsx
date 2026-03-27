import { useState, useEffect } from "react";

import { API_URL } from "../../App";

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
      await fetch(`${API_URL}/toggle_allowed_gpu`, {
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

  if (!data) return (
    <div className="card bg-gradient-secondary worker-toggle-shell">
      <div className="card worker-toggle-inner">
        <div className="card-header pb-0 bg-transparent">
          <h6>Worker Toggle</h6>
        </div>
      </div>
    </div>);

  return (
    <div className="card bg-gradient-secondary worker-toggle-shell">
      <div className="card worker-toggle-inner">
        <div className="card-header pb-0 bg-transparent">
          <h6>Worker Toggle</h6>
        </div>
        <div className="card-body pt-1 worker-toggle-body">
          <div className="worker-toggle-content">
            <div className="text-center worker-toggle-scroll-shell">
              <div className="d-flex justify-content-center align-items-center worker-toggle-grid-wrap">
              <div className="row worker-toggle-grid">
                {Array.from(
                  { length: data.monitor.gpu_name.length },
                  (_, i) => (
                    <div key={i} className="col-6 my-1 px-1 worker-toggle-item">
                      <div className="d-flex justify-content-between align-items-center border rounded p-2 worker-toggle-card">
                        <span
                          className={`worker-toggle-status-indicator ${data.monitor.gpu_availability[i] === 0 ? "bg-danger" : "bg-success"}`}
                        ></span>
                        
                        <span className="worker-toggle-label">
                          GPU {i} ({data.monitor.gpu_name[i]})
                        </span>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`gpu-toggle-${i}`}
                            checked={enabled[i]}
                            onChange={() => toggleGpu(i)}
                          />
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GpuToggleList;
