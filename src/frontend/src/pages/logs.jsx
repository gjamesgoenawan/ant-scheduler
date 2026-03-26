import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useMonitorData, API_URL } from "../App";
import Layout, { useToast } from "../components/layout/layout";
import {
  copyCommand,
  downloadLog,
  deleteTask,
  terminateTask,
  restartTask,
} from "../utils/taskActions";


function Logs() {
  const { data } = useMonitorData();
  const [logs, setLogs] = useState("");
  const [taskInfo, setTaskInfo] = useState(null);
  const [statusState, setStatusState] = useState("loading"); // loading, running, completed, terminated, unknown
  const [taskNotFound, setTaskNotFound] = useState(false); 

  const query = new URLSearchParams(useLocation().search);
  const taskId = query.get("task_id");

  const { addToast } = useToast();

  useEffect(() => {
    document.title = `Task Log (${taskId})`;
  }, [taskId]);

  useEffect(() => {
    if (!data || !taskId) return;

    let foundTask = null; 
    let status = "unknown";
    
    // task can be in completed or ongoing
    const completedTask = data.task_completed?.find((t) => t.task_id === taskId);
    if (completedTask) {
      foundTask = completedTask;
      status = completedTask.terminated ? "terminated" : "completed";
    }

    if (!foundTask && data.task_ongoing) {
      const ongoingTask = data.task_ongoing.find((t) => t.task_id === taskId);
      if (ongoingTask) {
        foundTask = ongoingTask;
        
        if (!foundTask.time?.runtime) {
             foundTask.time = { ...foundTask.time, runtime: "Running..." };
        }
        status = "running";
      }
    }
    
    setTaskInfo(foundTask);
    setStatusState(status);
    
    if (data && !foundTask && taskId) {
        setTaskNotFound(true);
    } else {
        setTaskNotFound(false);
    }

  }, [data, taskId]);

  // get the log
  useEffect(() => {
    if (taskId && !taskNotFound) { 
      fetch(`${API_URL}/get_log?task_id=${taskId}`)
        .then((res) => {
          if (!res.ok) {
             throw new Error("Network response was not ok");
          }
          return res.json();
        })
        .then((data) => {
          if (data.status === "success") {
            setLogs(data.data);
          } else {
            setLogs(data.message || "Failed to load logs.");
          }
        })
        .catch((err) => {
          console.error(err);
          setLogs("Error connecting to log service.");
        });
    }
  }, [taskId, taskNotFound]);

  const getStatusBadge = () => {
    switch (statusState) {
      case "running":
        return <p className="text-sm text-info font-weight-bold mb-0">Running</p>;
      case "terminated":
        return <p className="text-sm text-danger font-weight-bold mb-0">Terminated</p>;
      case "completed":
        return <p className="text-sm text-success font-weight-bold mb-0">Completed</p>;
      case "loading":
        return <p className="text-sm text-secondary font-weight-bold mb-0">Loading...</p>;
      default:
        return <p className="text-sm text-secondary font-weight-bold mb-0">Unknown</p>;
    }
  };

  return (
    <Layout pageTitle="Task Log">
      <div className="container-fluid py-2 logs-page">
        <div className="row mb-2">
          <div className="card log-task-card">
            
            <div className="card-header pb-2 log-task-header">
              <div className="d-flex justify-content-between align-items-center log-task-header-row">
                <h5 className="mb-0 log-task-title">{taskId}</h5>

                <div className="d-flex align-items-center gap-1 log-task-actions">
                  <button
                    className="btn btn-link text-dark p-2 mb-0"
                    title="Copy Command"
                    onClick={() => copyCommand(taskInfo, addToast)}
                  >
                    <i className="material-icons text-lg">copy</i>
                  </button>

                  <button
                    className="btn btn-link text-dark p-2 mb-0"
                    title="Restart Task"
                    onClick={() => restartTask(taskId, addToast)}
                    disabled={statusState === "running"}
                  >
                    <i className="material-icons text-lg">restart_alt</i>
                  </button>

                  <button
                    className="btn btn-link text-dark p-2 mb-0"
                    title="Download Log"
                    onClick={() => downloadLog(taskId, addToast)}
                  >
                    <i className="material-icons text-lg">save_alt</i>
                  </button>

                  <button
                    className="btn btn-link text-danger p-2 mb-0"
                    title={statusState === "running" ? "Kill Task" : "Delete Task"}
                    onClick={() =>
                      statusState === "running"
                        ? terminateTask(taskId, addToast)
                        : deleteTask(taskId, addToast)
                    }
                  >
                    <i className="material-icons text-lg">
                      {statusState === "running" ? "stop_circle" : "delete_outline"}
                    </i>
                  </button>
                </div>
              </div>
            </div>

            {statusState === "loading" ? (
                <div className="card-body">
                    <div className="alert alert-light text-center mb-4">Loading task details...</div>
                </div>
            ) : taskNotFound ? (
                <div className="card-body">
                    <div className="alert alert-light text-center mb-0">
                        Task ID <b>{taskId}</b> not found.
                    </div>
                </div>
            ) : (
                <div className="card-body px-4 pt-4 log-task-body">
              
                    <div className="bg-gray-100 rounded p-3 mb-4 log-task-summary" style={{ backgroundColor: "#f8f9fa" }}>
                      <div className="row">
                        
                        <div className="col-md-3 col-6 mb-3">
                          <span className="text-xs font-weight-bold text-secondary text-uppercase">Status</span>
                          <div className="mt-1">{getStatusBadge()}</div>
                        </div>
                        <> 
                          <div className="col-md-3 col-6 mb-3">
                            <span className="text-xs font-weight-bold text-secondary text-uppercase">Start Time</span>
                            <p className="text-sm text-dark font-weight-bold mb-0">
                              {taskInfo?.time?.start || "-"}
                            </p>
                          </div>

                          <div className="col-md-3 col-6 mb-3">
                            <span className="text-xs font-weight-bold text-secondary text-uppercase">Duration</span>
                            <p className="text-sm text-dark font-weight-bold mb-0">
                              {taskInfo?.time?.runtime || "-"}
                            </p>
                          </div>

                          <div className="col-md-3 col-6 mb-3">
                            <span className="text-xs font-weight-bold text-secondary text-uppercase">GPU IDs</span>
                            <p className="text-sm text-dark font-weight-bold mb-0">
                              {taskInfo?.gpu_ids && taskInfo.gpu_ids.length > 0 
                                ? taskInfo.gpu_ids.join(", ") 
                                : "No GPU Assigned"}
                            </p>
                          </div>

                        </>
                      </div>

                      <div className="log-task-command-row mt-1">
                        <div className="text-xs font-weight-bold text-secondary text-uppercase mb-2">Command</div>
                        <div className="log-task-command">
                          <code className="text-dark log-task-command-text" style={{ wordBreak: "break-all" }}>
                            {taskInfo?.command || "-"}
                          </code>
                        </div>
                      </div>
                    </div>
                  
                    <h6 className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 mb-2">
                      Log Output
                    </h6>
                    <div 
                      className="bg-black text-light p-3 rounded log-output-shell" 
                      style={{ minHeight: "300px" }}
                    >
                      <pre className="log-output-pre" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{logs || "Failed to load Log."}</pre>
                    </div>

                </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Logs;
