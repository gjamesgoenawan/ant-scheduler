import React, { useEffect, useRef } from "react";
import { Link } from 'react-router-dom'; 
import { useToast } from "../layout/layout";

export default function OngoingTaskTerminal({
  task,
  idx,
  onTerminate,
}) {
  const { addToast } = useToast();
  const terminalRef = useRef(null);

  // Auto-scroll terminal content
  useEffect(() => {
    const ref = terminalRef.current;
    if (!ref) return;

    if (!ref.dataset.initialScrollDone) {
      ref.scrollTop = ref.scrollHeight;
      ref.dataset.initialScrollDone = true;
    } else {
      const isAtBottom =
        Math.abs(ref.scrollHeight - ref.scrollTop - ref.clientHeight) < 5;
      if (isAtBottom) {
        ref.scrollTop = ref.scrollHeight;
      }
    }
  }, [task.console_out]);

  const copyCommandToClipboard = (command) => {
    navigator.clipboard.writeText(command).then(() => {
      addToast({
        type: "success",
        title: "Command Copied Successfully!",
        autohide: true,
        delay: 2000,
      });
    });
  };

  return (
    <div className="row mb-4" key={task.task_id}>
      <div className="card" id={`task-data-${idx}`}>
        <div className="card-header pb-0" id={`task-id-${idx}`}>
          <div className="d-flex align-items-center justify-content-between">
            <a 
              style={{ textTransform: 'none' }} 
              href={`/logs?task_id=${task.task_id}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <h4 className="mb-0 mt-2">{task.task_id}</h4>
            </a>
          </div>
        </div>
        <div className="card-body">
          <ul className="list-group">
            <li className="list-group-item border-0 ps-0 pt-0 text-sm">
              <strong className="text-dark">Status :</strong>{" "}
              <span className="badge badge-sm bg-gradient-info">
                Running
              </span>
            </li>
            <li className="list-group-item border-0 ps-0 pt-0 text-sm">
              <strong className="text-dark">Running Time :</strong>{" "}
              {task.time.runtime}
            </li>
            <li className="list-group-item border-0 ps-0 pt-0 text-sm">
              <strong className="text-dark">GPU IDs :</strong>{" "}
              {task.gpu_ids.join(", ") || "No GPU Assigned"}
            </li>
            <li className="list-group-item border-0 ps-0 pt-0 text-sm">
              <strong className="text-dark">Command :</strong>{" "}
              {task.command}
            </li>

            <div className="terminal-window">
              <div
                className="terminal-content"
                ref={terminalRef}
              >
                {task.console_out.join("\n")}
              </div>
            </div>

            <div
              id="action-buttons"
              style={{ textAlign: "right", float: "right" }}
            >
              <button
                className="btn btn-link text-dark px-3 py-0 mt-3 mb-1"
                onClick={() => copyCommandToClipboard(task.command)}
              >
                <i className="material-icons text-m me-2">copy</i>
              </button>

              <button
                className="btn btn-link text-dark px-3 py-0 mt-3 mb-1"
                style={{ marginRight: "10px" }}
                onClick={() =>
                  window.open(`/logs?task_id=${task.task_id}`, "_blank")
                }
              >
                <i className="material-icons text-m me-2">
                  open_in_new
                </i>
              </button>

              <button
                className="btn btn-danger mt-3 mb-1"
                onClick={() => onTerminate(task.task_id)}
              >
                Terminate
              </button>
            </div>
          </ul>
        </div>
      </div>
    </div>
  );
}
