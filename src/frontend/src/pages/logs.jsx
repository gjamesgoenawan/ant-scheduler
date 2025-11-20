import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useMonitorData, API_URL } from "../App";
import Layout, { useToast } from "../components/layout/layout";

function Logs() {
  const { data } = useMonitorData();
  const [logs, setLogs] = useState("");
  const [taskInfo, setTaskInfo] = useState(null);
  const [statusState, setStatusState] = useState("loading"); // loading, running, completed, terminated
  
  const query = new URLSearchParams(useLocation().search);
  const taskId = query.get("task_id");

  useEffect(() => {
    document.title = `Task Log (${taskId})`;
  }, [taskId]);

  useEffect(() => {
    if (!data || !taskId) return;

    const completedTask = data.task_completed?.find((t) => t.task_id === taskId);
    
    if (completedTask) {
      setTaskInfo(completedTask);
      setStatusState(completedTask.terminated ? "terminated" : "completed");
      return;
    }

    let runningTask = null;
    if (data.gpu_status) {
      Object.values(data.gpu_status).forEach((gpu) => {
        if (gpu.task_id === taskId) {
          runningTask = {
            task_id: taskId,
            time: { start: gpu.start_time, runtime: "Running..." },
            gpu_ids: [gpu.id],
            command: gpu.command,
          };
        }
      });
    }

    if (runningTask) {
      setTaskInfo(runningTask);
      setStatusState("running");
    } else {
      setStatusState("unknown");
    }

  }, [data, taskId]);

  useEffect(() => {
    if (taskId) {
      fetch(`${API_URL}/get_log?task_id=${taskId}`)
        .then((res) => res.json())
        .then((data) => {
          setLogs(data.data);
        })
        .catch((err) => console.error(err));
    }
  }, [taskId]);


  const getStatusBadge = () => {
    switch (statusState) {
      case "running":
        return <p className="text-sm text-info font-weight-bold mb-0">Running</p>;
      case "terminated":
        return <p className="text-sm text-danger font-weight-bold mb-0">Terminated</p>;
      case "completed":
        return <p className="text-sm text-success font-weight-bold mb-0">Completed</p>;
      default:
        return <p className="text-sm text-secondary font-weight-bold mb-0">Unknown</p>;
    }
  };

  return (
    <Layout pageTitle="Task Log">
      <div className="container-fluid py-2">
        <div className="row mb-2">
          <div className="card">
            
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{taskId}</h5>
              </div>
            </div>

            <div className="card-body px-4 pt-4">
              
              {taskInfo ? (
                <div className="bg-gray-100 rounded p-3 mb-4" style={{ backgroundColor: "#f8f9fa" }}>
                  <div className="row">
                    <div className="col-md-3 col-6 mb-3">
                      <span className="text-xs font-weight-bold text-secondary text-uppercase">Status</span>
                      <div className="mt-1">{getStatusBadge()}</div>
                    </div>

                    <div className="col-md-3 col-6 mb-3">
                      <span className="text-xs font-weight-bold text-secondary text-uppercase">Start Time</span>
                      <p className="text-sm text-dark font-weight-bold mb-0">
                        {taskInfo.time?.start || "-"}
                      </p>
                    </div>

                    <div className="col-md-3 col-6 mb-3">
                      <span className="text-xs font-weight-bold text-secondary text-uppercase">Duration</span>
                      <p className="text-sm text-dark font-weight-bold mb-0">
                        {taskInfo.time?.runtime || "-"}
                      </p>
                    </div>

                    <div className="col-md-3 col-6 mb-3">
                      <span className="text-xs font-weight-bold text-secondary text-uppercase">GPU IDs</span>
                      <p className="text-sm text-dark font-weight-bold mb-0">
                        {taskInfo.gpu_ids && taskInfo.gpu_ids.length > 0 
                          ? taskInfo.gpu_ids.join(", ") 
                          : "No GPU Assigned"}
                      </p>
                    </div>

                    <div className="col-12 mt-1">
                      <span className="text-xs font-weight-bold text-secondary text-uppercase">Command</span>
                      <div className="p-2 border rounded bg-white mt-1">
                        <code className="text-dark" style={{ wordBreak: "break-all" }}>
                          {taskInfo.command || "Command not available"}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                 <div className="alert alert-light text-center mb-4">Loading task details...</div>
              )}

              <h6 className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 mb-2">
                Log Output
              </h6>
              <div 
                className="bg-black text-light p-3 rounded" 
                style={{ minHeight: "300px" }}
              >
                 <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{logs || "No logs available..."}</pre>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Logs;