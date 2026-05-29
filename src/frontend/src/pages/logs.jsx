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
import TaskDetail from "../components/visualization/task_detail";


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
      fetch(`${API_URL}/get_log?task_id=${encodeURIComponent(taskId)}`)
        .then(async (res) => {
          const payload = await res.json().catch(() => null);
          if (!res.ok) {
             throw new Error(payload?.message || payload?.data || "Failed to load logs.");
          }
          return payload;
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
          setLogs(String(err.message || err || "Failed to load logs."));
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
          <TaskDetail
            taskId={taskId}
            taskInfo={taskInfo}
            statusContent={getStatusBadge()}
            renderHeaderActions={() => (
              <>
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
                    {statusState === "running" ? "cancel" : "delete_outline"}
                  </i>
                </button>
              </>
            )}
            outputLabel="Log Output"
            outputType="log"
            outputContent={logs}
            outputMinHeight="300px"
            loading={statusState === "loading"}
            notFound={taskNotFound}
            notFoundMessage={
              <>
                Task ID <b>{taskId}</b> not found.
              </>
            }
          />
        </div>
      </div>
    </Layout>
  );
}

export default Logs;
