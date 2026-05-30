import React, { useEffect, useRef, useState } from "react";
import { buildOutputWindowStyle } from "../../utils/outputWindow";

export default function TaskDetail({
  taskId,
  taskInfo,
  titleHref = null,
  statusContent,
  renderHeaderActions,
  outputLabel,
  outputType = "log",
  outputContent = "",
  outputMinHeight = "300px",
  outputMinLines = null,
  outputMaxLines = null,
  collapsible = false,
  defaultExpanded = true,
  expanded,
  onExpandedChange,
  loading = false,
  notFound = false,
  loadingMessage = "Loading task details...",
  notFoundMessage = null,
}) {
  const terminalRef = useRef(null);
  const [localShowDetails, setLocalShowDetails] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const showDetails = isControlled ? expanded : localShowDetails;

  const setShowDetails = (nextValue) => {
    const next = typeof nextValue === "function" ? nextValue(showDetails) : nextValue;
    if (!isControlled) {
      setLocalShowDetails(next);
    }
    if (onExpandedChange) {
      onExpandedChange(next);
    }
  };

  useEffect(() => {
    if (!collapsible || outputType !== "terminal" || !showDetails) return;

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
  }, [collapsible, outputContent, outputType, showDetails]);

  const shouldShowDetails = collapsible ? showDetails : true;
  const outputShellStyle =
    outputType === "terminal"
      ? outputMinLines && outputMaxLines
        ? buildOutputWindowStyle(outputMinLines, outputMaxLines)
        : { minHeight: "180px", maxHeight: "250px" }
      : { minHeight: outputMinHeight };

  const titleNode = (
    <h6 className="dashboard-ops-title task-detail-title mb-0">
      {taskId}
    </h6>
  );

  return (
    <div className="task-detail-card dashboard-ops-panel">
      <div className="task-detail-header">
        <div className="task-detail-top">
          <div className="task-detail-copy">
            <div className="dashboard-panel-eyebrow">Task ID</div>
            {titleHref ? (
              <a
                className="task-detail-link"
                style={{ textTransform: "none" }}
                href={titleHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {titleNode}
              </a>
            ) : (
              titleNode
            )}
          </div>

          <div className="task-detail-controls">
            {renderHeaderActions?.({ showDetails, setShowDetails })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="task-detail-body">
          <div className="alert alert-light text-center mb-4">{loadingMessage}</div>
        </div>
      ) : notFound ? (
        <div className="task-detail-body">
          <div className="alert alert-light text-center mb-0">
            {notFoundMessage || `Task ID ${taskId} not found.`}
          </div>
        </div>
      ) : (
        <div className="task-detail-body">
          <div
            className={`task-detail-summary bg-gray-100 rounded p-3 ${
              shouldShowDetails ? "mb-4" : "mb-0"
            }`}
            style={{ backgroundColor: "#f8f9fa" }}
          >
            <div className="row">
              <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">Status</span>
                <div className="mt-1">{statusContent}</div>
              </div>

              <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">Start Time</span>
                <p className="text-sm text-dark font-weight-bold mb-0">{taskInfo?.time?.start || "-"}</p>
              </div>

              <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">Duration</span>
                <p className="text-sm text-dark font-weight-bold mb-0">{taskInfo?.time?.runtime || "-"}</p>
              </div>

              <div className="col-md-3 col-6 mb-3">
                <span className="text-xs font-weight-bold text-secondary text-uppercase">GPU IDs</span>
                <p className="text-sm text-dark font-weight-bold mb-0">
                  {taskInfo?.gpu_ids && taskInfo.gpu_ids.length > 0
                    ? taskInfo.gpu_ids.join(", ")
                    : "No GPU Assigned"}
                </p>
              </div>
            </div>

            {shouldShowDetails ? (
              <div className="task-detail-command-row mt-1">
                <div className="text-xs font-weight-bold text-secondary text-uppercase mb-2">Command</div>
                <div className="task-detail-command">
                  <code className="text-dark task-detail-command-text" style={{ wordBreak: "break-all" }}>
                    {taskInfo?.command || "-"}
                  </code>
                </div>
              </div>
            ) : null}
          </div>

          {shouldShowDetails ? (
            <>
              <h6 className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 mb-2">
                {outputLabel}
              </h6>
              <div
                className="bg-black text-light p-3 rounded task-detail-output-shell"
                ref={outputType === "terminal" ? terminalRef : null}
                style={outputShellStyle}
              >
                <pre className="task-detail-output-pre" style={{ margin: 0, whiteSpace: "pre" }}>
                  {outputContent || "Failed to load Log."}
                </pre>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
