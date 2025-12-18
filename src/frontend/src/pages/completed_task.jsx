import React, { useEffect, useState } from "react";
import Layout, { useToast } from "../components/layout/layout";
import { useMonitorData, API_URL } from "../App";
import {
  copyCommand,
  downloadLog,
  deleteTask,
  restartTask,
} from "../utils/taskActions";


const TaskRow = ({ task, isLast, onCopy, onRestart, onDelete, onDownload }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusSquare = (
    <div
      className={`rounded-1 ${task.terminated ? "bg-danger" : "bg-success"}`}
      style={{ width: "5px", height: "30px" }}
      title={task.terminated ? "Terminated" : "Completed"}
      data-bs-toggle="tooltip" 
      data-bs-placement="top"
    ></div>
  );

  const detailedBadge = task.terminated ? (
    <p className="text-sm text-danger font-weight-bold mb-0">Terminated</p>
    
  ) : (
    <p className="text-sm text-success font-weight-bold mb-0">Completed</p>
  );

  return (
    <div className={`px-4 py-3 ${!isLast ? "border-bottom" : ""}`}>
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
            <div>
                {statusSquare}
            </div>
            <div className="text-truncate" style={{ minWidth: 0 }}>
              <a
                style={{ textTransform: "none", cursor: "pointer" }}
                href={`/logs?task_id=${task.task_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-weight-bold"
                title={task.task_id}
              >
                {task.task_id}
              </a>
            </div>
        </div>
        <div className="d-flex align-items-center ms-3" style={{ flexShrink: 0 }}>
          <div className="d-flex align-items-center me-3">

             <button
              className="btn btn-link text-dark p-2 mb-0"
              onClick={() =>
                onCopy(task)
              }
              title="Copy Command"
            >
              <i className="material-icons text-lg">copy</i>
            </button>

            <button
              className="btn btn-link text-dark p-2 mb-0"
              onClick={() =>
                onRestart(task)
              }
              title="Restart Task"
            >
              <i className="material-icons text-lg">restart_alt</i>
            </button>

            <button
              className="btn btn-link text-dark p-2 mb-0"
              onClick={() => window.open(`/logs?task_id=${task.task_id}`, "_blank")}
              title="View Log"
            >
              <i className="material-icons text-lg">open_in_new</i>
            </button>

            <button
              className="btn btn-link text-dark p-2 mb-0"
              onClick={() => onDownload(task)}
              title="Download Log"
            >
              <i className="material-icons text-lg">save_alt</i>
            </button>

            <button
              className="btn btn-link text-danger p-2 mb-0"
              title="Delete Task"
              onClick={() => onDelete(task)}
            >
              <i className="material-icons text-lg">delete_outline</i>
            </button>
          </div>

          <button
            className="btn btn-light btn-sm mb-0 px-3 d-flex align-items-center"
            onClick={() => setIsExpanded(!isExpanded)}
          >
             <span className="d-none d-md-inline">Details</span>
             <i className="material-icons text-sm ms-md-1">
                {isExpanded ? "expand_less" : "expand_more"}
             </i>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 bg-gray-100 rounded p-3" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="row">
             <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">Status</span>
                 {detailedBadge}
             </div>

             <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">Start Time</span>
                <p className="text-sm text-dark font-weight-bold mb-0">{task.time.start}</p>
             </div>
             
             <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">Duration</span>
                <p className="text-sm text-dark font-weight-bold mb-0">{task.time.runtime}</p>
             </div>
             
             <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">GPU IDs</span>
                <p className="text-sm text-dark font-weight-bold mb-0">
                    {task.gpu_ids.join(", ") || "No GPU Assigned"}
                </p>
             </div>
             
             <div className="col-12 mt-1">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">Command</span>
                <div className="p-2 border rounded bg-white mt-1">
                    <code className="text-dark" style={{ wordBreak: "break-all" }}>{task.command}</code>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function CompletedTasks() {
  const { data } = useMonitorData();
  const { addToast } = useToast();
  const [completedTasks, setCompletedTasks] = useState([]);

  useEffect(() => {
    if (data?.task_completed) {
      setCompletedTasks(data.task_completed);
    }
  }, [data]);

  return (
    <Layout pageTitle="Completed Tasks">
      <div className="container-fluid py-2">
        <div className="row mb-2">
          <div className="card px-0">
            
            {/* Table-Like Header Row */}
            <div className="card-header pb-2 border-bottom">
              <div className="d-flex justify-content-between px-2">
                  <div className="d-flex gap-4 align-items-center">
                      <span className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Task ID</span>
                  </div>
                  <span className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 me-5">Actions</span>
              </div>
            </div>

            <div className="card-body p-0">
              {completedTasks.length === 0 ? (
                  <div className="text-center py-4 text-muted">No completed tasks found.</div>
              ) : (
                  completedTasks.map((task, idx) => (
                  <TaskRow 
                      key={task.task_id} 
                      task={task} 
                      isLast={idx === completedTasks.length - 1}
                      onCopy={(task) => copyCommand(task, addToast)}
                      onRestart={(task) => restartTask(task.task_id, addToast)}
                      onDownload={(task) => downloadLog(task.task_id, addToast)}
                      onDelete={(task) => deleteTask(task.task_id, addToast)}
                  />
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}