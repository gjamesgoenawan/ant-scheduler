import React, { useEffect, useRef, useState } from "react";
import { useToast } from "../layout/layout";
import { copyCommand } from "../../utils/taskActions";

export default function OngoingTaskTerminal({
  task,
  idx,
  onTerminate,
}) {
  const { addToast } = useToast();
  const terminalRef = useRef(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showDetails, setShowDetails] = useState(idx === 0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767.98px)");

    const syncMobileState = (event) => {
      const mobile = event.matches;
      setIsMobileView(mobile);
    };

    syncMobileState(mediaQuery);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncMobileState);
      return () => mediaQuery.removeEventListener("change", syncMobileState);
    }

    mediaQuery.addListener(syncMobileState);
    return () => mediaQuery.removeListener(syncMobileState);
  }, []);

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

  return (
    <div className="row mb-4" key={task.task_id}>
      <div className="ongoing-task-card dashboard-ops-panel" id={`task-data-${idx}`}>
        <div className="ongoing-task-panel-header" id={`task-id-${idx}`}>
          <div className="ongoing-task-panel-top">
            <div className="ongoing-task-header-copy">
              <div className="dashboard-panel-eyebrow">Task ID</div>
              <a
                className="ongoing-task-link"
                style={{ textTransform: "none" }}
                href={`/logs?task_id=${task.task_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <h6 className="dashboard-ops-title ongoing-task-title mb-0">{task.task_id}</h6>
              </a>
            </div>

            <div className="ongoing-task-header-controls">
              <button
                className="btn btn-link text-dark p-1 mb-0 d-flex align-items-center ongoing-task-mobile-toggle"
                onClick={() => setShowDetails((current) => !current)}
              >
                <span className="text-xxs text-uppercase font-weight-bolder me-1">
                  {showDetails ? "Hide" : "Show"}
                </span>
                <i className="material-icons text-sm">
                  {showDetails ? "expand_less" : "expand_more"}
                </i>
              </button>
            </div>
          </div>
        </div>
        <div className="ongoing-task-panel-body">
          <div className="bg-gray-100 rounded p-3 ongoing-task-details-shell" style={{ backgroundColor: "#f8f9fa" }}>
            <div
              className={`ongoing-task-summary ${showDetails ? "mb-3" : "mb-0"}`}
            >
              <div className="row">
                <div className="col-md-4 col-6 mb-3">
                  <span className="text-xs font-weight-bold text-secondary text-uppercase">Start Time</span>
                  <p className="text-sm text-dark font-weight-bold mb-0">{task.time?.start || "-"}</p>
                </div>

                <div className="col-md-4 col-6 mb-3">
                  <span className="text-xs font-weight-bold text-secondary text-uppercase">Running Time</span>
                  <p className="text-sm text-dark font-weight-bold mb-0">{task.time.runtime}</p>
                </div>

                <div className="col-md-4 col-12 mb-3">
                  <span className="text-xs font-weight-bold text-secondary text-uppercase">GPU IDs</span>
                  <p className="text-sm text-dark font-weight-bold mb-0">
                    {task.gpu_ids.join(", ") || "No GPU Assigned"}
                  </p>
                </div>
              </div>
            </div>

            {showDetails ? (
              <>
              <div className="ongoing-task-command-panel mb-3">
                <div className="text-xs font-weight-bold text-secondary text-uppercase mb-2">Command</div>
                <code className="text-dark ongoing-task-command-text">{task.command}</code>
              </div>
              <div className="terminal-window">
                <div
                  className="terminal-content"
                  ref={terminalRef}
                >
                  {task.console_out.join("\n")}
                </div>
              </div>
              </>
            ) : null}
          </div>

          <div
              className="ongoing-task-actions"
              id="action-buttons"
              style={{ textAlign: "right", float: "right" }}
            >
              <button
                className="btn btn-link text-dark px-3 py-0 mt-3 mb-1"
                onClick={() => copyCommand(task, addToast)}
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
                <i className="material-icons text-sm me-1">
                  open_in_new
                </i>
              </button>

              <button
                className="btn btn-danger mt-3 mb-1 ongoing-task-terminate-btn"
                onClick={() => onTerminate(task.task_id)}
              >
                Terminate
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
