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
    <div className="card bg-gradient-secondary"  style={{ width: '100%', 
                                                          height: '100%' }}>
      <div className="card"  style={{ width: '100%', 
                                      height: '100%' }}>
        <div className="card-header pb-0 bg-transparent">
          <h6>Worker Toggle</h6>
        </div>
      </div>
    </div>);

  return (
    <div className="card bg-gradient-secondary" style={{ width: '100%', 
                                                         height: '100%' }}>
      <div className="card" style={{ width: '100%', 
                                     height: '100%' }}>
        <div className="card-header pb-0 bg-transparent">
          <h6>Worker Toggle</h6>
        </div>
        <div className="card-body pt-1" 
          style={{ width: '100%', 
                   height: '100px', }}>
          <div
            style={{ height: '100%',}}
          >
            <div className="text-center" 
              style={{ width: '98%', 
                       height: '100%', 
                       overflowY: "scroll", 
                       position: "relative", 
                       margin: "0 auto"}}>
              <div className="d-flex justify-content-center align-items-center"
                style={{ 
                  minHeight: "100%",
                  width: "100%",
                  overflowY: "auto",
                }}
              >
              <div className="row"
               style={{ 
                  width: "100%",
                  position: "relative",
                  margin: "0 auto"
                }}>
                {Array.from(
                  { length: data.monitor.gpu_name.length },
                  (_, i) => (
                    <div key={i} className="col-6 my-1 px-1">
                      <div className="d-flex justify-content-between align-items-center border rounded p-2" style={{ fontSize: '10pt' }}>
                        <span className={
                            data.monitor.gpu_availability[i] === 0 ? "bg-danger" : "bg-success"
                          }
                          style={{
                            width: "4px",
                            height: "10px",
                            marginRight: "1px"
                          }}></span>
                        
                        <span>
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
