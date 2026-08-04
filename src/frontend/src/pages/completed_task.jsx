import React, { useEffect, useRef, useState } from "react";
import Layout, { useToast } from "../components/layout/layout";
import LineCountControl from "../components/line_count_control";
import { API_URL, useMonitorData } from "../App";
import {
  bulkDeleteTasks,
  bulkDownloadLogs,
  bulkRestartTasks,
  copyCommand,
  downloadLog,
  deleteTask,
  restartTask,
} from "../utils/taskActions";
import {
  getStoredBoolean,
  readStoredNumber,
  readBooleanMap,
  writeStoredValue,
  writeBooleanMap,
} from "../utils/persistedTaskState";
import { fetchLogContent } from "../utils/logFetch";
import { clampLineCount, takeLastLinesFromText } from "../utils/lineCount";
import { buildOutputWindowStyle, getOutputWindowLines } from "../utils/outputWindow";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { taskMatchesSearch } from "../utils/taskSearch";
import { sortTasks, TASK_SORT_OPTIONS } from "../utils/taskSort";

const COMPLETED_DETAIL_STORAGE_KEY = "antScheduler.completedTasks.detailExpanded";
const COMPLETED_OUTPUT_STORAGE_KEY = "antScheduler.completedTasks.outputExpanded";
const COMPLETED_OUTPUT_LINE_COUNT_STORAGE_KEY = "antScheduler.completedTasks.outputLineCount";
const COMPLETED_OUTPUT_FETCH_CHUNK = 50;
const completedTaskOutputCache = new Map();

const TaskRow = ({
  task,
  isLast,
  isSelectMode,
  isSelected,
  isExpanded,
  isOutputExpanded,
  onToggleSelect,
  onToggleExpanded,
  onToggleOutput,
  onCopy,
  onRestart,
  onDelete,
  onHide,
  onDownload,
  outputLineCount,
  outputFetchLineCount,
  outputShellStyle,
}) => {
  const initialCacheEntry = completedTaskOutputCache.get(task.task_id);
  const [outputContent, setOutputContent] = useState(initialCacheEntry?.content || "");
  const [outputLoading, setOutputLoading] = useState(false);
  const [outputError, setOutputError] = useState(null);
  const [loadedOutputLineCount, setLoadedOutputLineCount] = useState(
    initialCacheEntry?.fetchedLineCount || 0
  );
  const outputShellRef = useRef(null);

  useEffect(() => {
    if (!isExpanded || !isOutputExpanded) return;

    const cachedEntry = completedTaskOutputCache.get(task.task_id);
    if (cachedEntry?.content) {
      if (cachedEntry.content !== outputContent) {
        setOutputContent(cachedEntry.content);
      }
      if (cachedEntry.fetchedLineCount !== loadedOutputLineCount) {
        setLoadedOutputLineCount(cachedEntry.fetchedLineCount);
      }
      setOutputError(null);
    }

    if (cachedEntry?.content && cachedEntry.fetchedLineCount >= outputFetchLineCount) {
      return;
    }

    let cancelled = false;
    setOutputLoading(true);
    setOutputError(null);

    fetchLogContent(task.task_id, { tailLines: outputFetchLineCount })
      .then((content) => {
        if (cancelled) return;
        completedTaskOutputCache.set(task.task_id, {
          content,
          fetchedLineCount: outputFetchLineCount,
        });
        setOutputContent(content);
        setLoadedOutputLineCount(outputFetchLineCount);
      })
      .catch((error) => {
        if (cancelled) return;

        const staleCacheEntry = completedTaskOutputCache.get(task.task_id);
        if (staleCacheEntry?.content) {
          setOutputContent(staleCacheEntry.content);
          setLoadedOutputLineCount(staleCacheEntry.fetchedLineCount);
          setOutputError(null);
          return;
        }

        setOutputError(String(error.message || error));
      })
      .finally(() => {
        if (cancelled) return;
        setOutputLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [task.task_id, isExpanded, isOutputExpanded, outputFetchLineCount, outputContent, loadedOutputLineCount]);

  const displayedOutput = outputError
    ? outputError
    : takeLastLinesFromText(outputContent, outputLineCount);

  useEffect(() => {
    if (!isExpanded || !isOutputExpanded) return;

    const ref = outputShellRef.current;
    if (!ref) return;

    ref.scrollTop = ref.scrollHeight;
  }, [displayedOutput, isExpanded, isOutputExpanded, outputLoading]);

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
    <div
      className={`completed-task-row px-4 py-3 ${!isLast ? "border-bottom" : ""} ${isSelectMode ? "cursor-pointer" : ""}`}
      style={{
        backgroundColor: isSelected ? "#eef6ff" : "#fff",
        transition: "background-color 0.18s ease",
      }}
      onClick={isSelectMode ? () => onToggleSelect(task.task_id) : undefined}
    >
      <div className="completed-task-row-top d-flex align-items-start justify-content-between gap-3">
        <div className="completed-task-meta d-flex align-items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
              {isSelectMode ? (
                <div
                  className="completed-task-selector d-flex justify-content-center align-items-center flex-shrink-0"
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    border: `1px solid ${isSelected ? "#5e72e4" : "#d2d6da"}`,
                    backgroundColor: isSelected ? "#f0f3ff" : "#fff",
                  }}
              >
                <i
                  className={`material-icons ${isSelected ? "text-primary" : "text-secondary opacity-50"}`}
                  style={{ fontSize: "16px" }}
                >
                  {isSelected ? "check_box" : "check_box_outline_blank"}
                </i>
              </div>
            ) : null}
            <div>
                {statusSquare}
            </div>
            <div
              className="completed-task-id-wrap"
              style={{ minWidth: 0, paddingLeft: isSelectMode ? "8px" : 0 }}
            >
              <a
                className={`completed-task-link font-weight-bold ${isSelected ? "text-primary" : ""}`}
                style={{ textTransform: "none", cursor: "pointer" }}
                href={`/logs?task_id=${task.task_id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={task.task_id}
                onClick={(e) => {
                  if (isSelectMode) {
                    e.preventDefault();
                    onToggleSelect(task.task_id);
                  }
                }}
              >
                {task.task_id}
              </a>
            </div>

            <button
              className="completed-task-details-btn-mobile btn btn-link text-dark p-1 mb-0 d-flex align-items-center ongoing-task-mobile-toggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded(task.task_id);
              }}
            >
              <span className="text-xxs text-uppercase font-weight-bolder">
                {isExpanded ? "Hide" : "Show"}
              </span>
              <i className="material-icons text-sm ms-1">
                {isExpanded ? "expand_less" : "expand_more"}
              </i>
            </button>
        </div>

        <div
          className="completed-task-actions d-flex align-items-center flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="completed-task-action-icons d-flex align-items-center">
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
              className="btn btn-link text-secondary p-2 mb-0"
              title="Hide Task"
              onClick={() => onHide(task)}
            >
              <i className="material-icons text-lg">visibility_off</i>
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
            className="completed-task-details-btn completed-task-details-btn-desktop btn btn-link text-dark p-1 mb-0 d-flex align-items-center ongoing-task-mobile-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(task.task_id);
            }}
          >
             <span className="text-xxs text-uppercase font-weight-bolder">
                {isExpanded ? "Hide" : "Show"}
             </span>
             <i className="material-icons text-sm ms-1">
                {isExpanded ? "expand_less" : "expand_more"}
             </i>
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="completed-task-expanded-panel mt-2 bg-gray-100 rounded p-2" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="row">
            <div className="col-md-3 col-6 mb-2">
              <span className="text-xs font-weight-bold text-secondary text-uppercase">Status</span>
              {detailedBadge}
            </div>

            <div className="col-md-3 col-6 mb-2">
              <span className="text-xs font-weight-bold text-secondary text-uppercase">Start Time</span>
              <p className="text-sm text-dark font-weight-bold mb-0">{task.time.start}</p>
            </div>
             
            <div className="col-md-3 col-6 mb-2">
              <span className="text-xs font-weight-bold text-secondary text-uppercase">Duration</span>
              <p className="text-sm text-dark font-weight-bold mb-0">{task.time.runtime}</p>
            </div>
             
            <div className="col-md-3 col-6 mb-0">
              <span className="text-xs font-weight-bold text-secondary text-uppercase">GPU IDs</span>
              <p className="text-sm text-dark font-weight-bold mb-0">
                {task.gpu_ids.join(", ") || "No GPU Assigned"}
              </p>
            </div>
             
            <div className="col-12 mt-1 task-detail-command-row">
              <div className="text-xs font-weight-bold text-secondary text-uppercase mb-2">Command</div>
              <div className="task-detail-command">
                <code className="text-dark task-detail-command-text" style={{ wordBreak: "break-all" }}>{task.command}</code>
              </div>
            </div>

            <div className="col-12 mt-2 completed-task-output-row">
              <div className="completed-task-output-header d-flex align-items-center justify-content-between gap-2 mb-2">
                <div className="d-flex align-items-center min-width-0">
                  <span className="text-xxs font-weight-bolder text-secondary text-uppercase opacity-7 completed-task-output-title">
                    Output (Last {outputLineCount} lines)
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-link text-dark p-1 mb-0 d-flex align-items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleOutput(task.task_id);
                  }}
                  title={isOutputExpanded ? "Hide Output" : "Show Output"}
                >
                  <span className="text-xxs text-uppercase font-weight-bolder">
                    {isOutputExpanded ? "Hide Output" : "Show Output"}
                  </span>
                  <i className="material-icons text-sm">
                    {isOutputExpanded ? "expand_less" : "expand_more"}
                  </i>
                </button>
              </div>

              {isOutputExpanded ? (
                <div className="bg-black text-light p-3 rounded completed-task-output-shell" ref={outputShellRef} style={outputShellStyle}>
                  <pre className="completed-task-output-pre">
                    {outputLoading && !outputContent
                      ? "Loading output..."
                      : displayedOutput || "Failed to load Log."}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default function CompletedTasks() {
  const { data } = useMonitorData();
  const { addToast } = useToast();
  const [completedTasks, setCompletedTasks] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState("completed-desc");
  const [detailExpandedByTaskId, setDetailExpandedByTaskId] = useState(() =>
    readBooleanMap(COMPLETED_DETAIL_STORAGE_KEY)
  );
  const [outputExpandedByTaskId, setOutputExpandedByTaskId] = useState(() =>
    readBooleanMap(COMPLETED_OUTPUT_STORAGE_KEY)
  );
  const [outputLineCount, setOutputLineCount] = useState(() =>
    readStoredNumber(COMPLETED_OUTPUT_LINE_COUNT_STORAGE_KEY, null)
  );

  const outputLineCap = clampLineCount(data?.visualizer?.view_log_max_lines ?? 500, 1, 5000, 500);
  const defaultOutputLineCount = clampLineCount(
    data?.visualizer?.completed_output_default_lines ?? 50,
    1,
    outputLineCap,
    50
  );
  const lineControlEnabled = data?.visualizer?.completed_output_line_control_enabled !== false;
  const effectiveOutputLineCount = clampLineCount(
    lineControlEnabled ? outputLineCount ?? defaultOutputLineCount : defaultOutputLineCount,
    1,
    outputLineCap,
    defaultOutputLineCount
  );
  const { minLines: outputMinLines, maxLines: outputMaxLines } = getOutputWindowLines(data?.visualizer);
  const outputShellStyle = buildOutputWindowStyle(outputMinLines, outputMaxLines);
  const outputFetchLineCount = Math.min(
    outputLineCap,
    Math.max(
      COMPLETED_OUTPUT_FETCH_CHUNK,
      Math.ceil(effectiveOutputLineCount / COMPLETED_OUTPUT_FETCH_CHUNK) * COMPLETED_OUTPUT_FETCH_CHUNK
    )
  );

  useEffect(() => {
    if (data?.task_completed) {
      setCompletedTasks(data.task_completed);
    }
  }, [data]);

  useEffect(() => {
    if (outputLineCount === null) return;

    const clamped = clampLineCount(outputLineCount, 1, outputLineCap, defaultOutputLineCount);
    if (clamped !== outputLineCount) {
      setOutputLineCount(clamped);
      writeStoredValue(COMPLETED_OUTPUT_LINE_COUNT_STORAGE_KEY, clamped);
    }
  }, [defaultOutputLineCount, outputLineCap]);

  useEffect(() => {
    setSelectedTaskIds((current) =>
      current.filter((taskId) =>
        completedTasks.some((task) => task.task_id === taskId)
      )
    );
  }, [completedTasks]);

  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  };

  const enterSelectMode = () => setIsSelectMode(true);
  const clearSelection = () => {
    setSelectedTaskIds([]);
    setIsSelectMode(false);
  };

  const isTaskExpanded = (task) =>
    getStoredBoolean(detailExpandedByTaskId, task.task_id, false);

  const isTaskOutputExpanded = (task) =>
    getStoredBoolean(outputExpandedByTaskId, task.task_id, true);

  const updateTaskExpanded = (taskId, expanded) => {
    setDetailExpandedByTaskId((current) => {
      const next = { ...current, [taskId]: expanded };
      writeBooleanMap(COMPLETED_DETAIL_STORAGE_KEY, next);
      return next;
    });
  };

  const updateTaskOutputExpanded = (taskId, expanded) => {
    setOutputExpandedByTaskId((current) => {
      const next = { ...current, [taskId]: expanded };
      writeBooleanMap(COMPLETED_OUTPUT_STORAGE_KEY, next);
      return next;
    });
  };

  const setAllDetailsExpanded = (expanded) => {
    setDetailExpandedByTaskId((current) => {
      const next = { ...current };
      completedTasks.forEach((task) => {
        next[task.task_id] = expanded;
      });
      writeBooleanMap(COMPLETED_DETAIL_STORAGE_KEY, next);
      return next;
    });
  };

  const setAllOutputsExpanded = (expanded) => {
    setOutputExpandedByTaskId((current) => {
      const next = { ...current };
      completedTasks.forEach((task) => {
        next[task.task_id] = expanded;
      });
      writeBooleanMap(COMPLETED_OUTPUT_STORAGE_KEY, next);
      return next;
    });
  };

  const handleBulkRestart = async () => {
    await bulkRestartTasks(selectedTaskIds, addToast);
  };

  const handleBulkDownload = async () => {
    await bulkDownloadLogs(selectedTaskIds, addToast);
  };

  const handleBulkDelete = async () => {
    await bulkDeleteTasks(selectedTaskIds, addToast);
  };

  const handleHideTask = async (task) => {
    try {
      const response = await fetchWithTimeout(`${API_URL}/hide_completed_tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: [task.task_id] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || `Hide Task failed with status ${response.status}`);
      }
      setCompletedTasks((current) => current.filter((item) => item.task_id !== task.task_id));
      addToast({
        type: "info",
        title: "Task Hidden",
        message: `${task.task_id} moved to Restore Tasks`,
        autohide: true,
        delay: 2200,
      });
    } catch (hideError) {
      addToast({
        type: "error",
        title: "Hide Failed",
        message: String(hideError.message || hideError),
        autohide: true,
        delay: 3000,
      });
    }
  };

  const filteredTasks = sortTasks(
    completedTasks.filter((task) => taskMatchesSearch(task, searchQuery)),
    sortMode
  );
  const allDetailsExpanded =
    completedTasks.length > 0 && completedTasks.every((task) => isTaskExpanded(task));
  const allOutputsExpanded =
    completedTasks.length > 0 && completedTasks.every((task) => isTaskOutputExpanded(task));

  const handleOutputLineCountChange = (nextValue) => {
    const normalized = clampLineCount(nextValue, 1, outputLineCap, defaultOutputLineCount);
    setOutputLineCount(normalized);
    writeStoredValue(COMPLETED_OUTPUT_LINE_COUNT_STORAGE_KEY, normalized);
  };

  const pageActions = (
    <>
      {lineControlEnabled ? (
        <LineCountControl
          label="Output Lines"
          value={effectiveOutputLineCount}
          min={1}
          max={outputLineCap}
          disabled={completedTasks.length === 0}
          onChange={handleOutputLineCountChange}
        />
      ) : null}
      <button
        type="button"
        className="btn btn-outline-dark page-action-btn mb-0 d-flex align-items-center gap-1"
        disabled={completedTasks.length === 0}
        onClick={() => setAllOutputsExpanded(!allOutputsExpanded)}
        title={allOutputsExpanded ? "Collapse All Output" : "Expand All Output"}
      >
        <i className="material-icons" style={{ fontSize: "16px" }}>
          {allOutputsExpanded ? "terminal" : "terminal"}
        </i>
        <span className="text-xxs text-uppercase font-weight-bolder">
          {allOutputsExpanded ? "Hide Output" : "Show Output"}
        </span>
      </button>
      <button
        type="button"
        className="btn btn-outline-dark page-action-btn mb-0 d-flex align-items-center gap-1"
        disabled={completedTasks.length === 0}
        onClick={() => setAllDetailsExpanded(!allDetailsExpanded)}
        title={allDetailsExpanded ? "Collapse All Details" : "Expand All Details"}
      >
        <i className="material-icons" style={{ fontSize: "16px" }}>
          {allDetailsExpanded ? "unfold_less" : "unfold_more"}
        </i>
        <span className="text-xxs text-uppercase font-weight-bolder">
          {allDetailsExpanded ? "Hide Details" : "Show Details"}
        </span>
      </button>
    </>
  );

  return (
    <Layout pageTitle="Completed Tasks" pageActions={pageActions}>
      <div className="container-fluid py-2 completed-task-page">
        <div className="row mb-2">
          <div className="px-0 overflow-hidden completed-task-shell">
            
            {/* Table-Like Header Row */}
            <div className="completed-task-panel-header pb-2 border-bottom">
              <div
                className="completed-task-toolbar d-flex justify-content-between align-items-center px-3 pb-3 border-bottom mb-3"
                style={{ minHeight: "42px" }}
              >
                <div
                  className="completed-task-toolbar-status d-flex align-items-center gap-3"
                  style={{ flex: "0 0 auto", minWidth: 0 }}
                >
                  {isSelectMode ? (
                    <div
                      className="completed-task-selected-chip completed-task-selected-chip-mobile d-inline-flex align-items-center gap-2"
                      style={{
                        padding: "0.3rem 0.65rem",
                        borderRadius: "999px",
                        backgroundColor: "#f8f9fa",
                        color: "#6c757d",
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <i className="material-icons" style={{ fontSize: "14px" }}>checklist</i>
                      <span className="text-xxs font-weight-bold mb-0 text-uppercase">
                        {selectedTaskIds.length} selected
                      </span>
                    </div>
                  ) : null}
                </div>

                <div
                  className="completed-task-toolbar-actions d-flex align-items-center justify-content-end gap-2"
                  style={{ flex: "1 1 auto", minHeight: "34px" }}
                >
                  {isSelectMode ? (
                    <>
                      <div
                        className="completed-task-selected-chip completed-task-selected-chip-desktop d-inline-flex align-items-center gap-2"
                        style={{
                          padding: "0.3rem 0.65rem",
                          borderRadius: "999px",
                          backgroundColor: "#f8f9fa",
                          color: "#6c757d",
                          border: "1px solid #e9ecef",
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: "14px" }}>checklist</i>
                        <span className="text-xxs font-weight-bold mb-0 text-uppercase">
                          {selectedTaskIds.length} selected
                        </span>
                      </div>
                      <button
                        className="btn btn-link text-dark p-1 mb-0 d-flex align-items-center gap-1"
                        disabled={selectedTaskIds.length === 0}
                        onClick={handleBulkDownload}
                        title="Download Selected"
                      >
                        <i className="material-icons" style={{ fontSize: "16px" }}>save_alt</i>
                        <span className="text-xxs text-uppercase font-weight-bolder">Download</span>
                      </button>
                      <button
                        className="btn btn-link text-dark p-1 mb-0 d-flex align-items-center gap-1"
                        disabled={selectedTaskIds.length === 0}
                        onClick={handleBulkRestart}
                        title="Restart Selected"
                      >
                        <i className="material-icons" style={{ fontSize: "16px" }}>restart_alt</i>
                        <span className="text-xxs text-uppercase font-weight-bolder">Restart</span>
                      </button>
                      <button
                        className="btn btn-link text-danger p-1 mb-0 d-flex align-items-center gap-1"
                        disabled={selectedTaskIds.length === 0}
                        onClick={handleBulkDelete}
                        title="Delete Selected"
                      >
                        <i className="material-icons" style={{ fontSize: "16px" }}>delete_outline</i>
                        <span className="text-xxs text-uppercase font-weight-bolder">Delete</span>
                      </button>
                      <button
                        className="btn btn-link text-secondary p-1 mb-0 d-flex align-items-center gap-1"
                        onClick={clearSelection}
                        title="Clear Selection"
                      >
                        <i className="material-icons" style={{ fontSize: "16px" }}>close</i>
                        <span className="text-xxs text-uppercase font-weight-bolder">Clear</span>
                      </button>
                    </>
                  ) : (
                    <button
                      className="completed-task-select-btn btn btn-link text-dark p-1 mb-0 d-flex align-items-center gap-1"
                      onClick={enterSelectMode}
                      title="Select"
                    >
                      <i className="material-icons" style={{ fontSize: "16px" }}>done_all</i>
                      <span className="text-xxs text-uppercase font-weight-bolder">Select</span>
                    </button>
                  )}
                </div>

                <div className="completed-task-toolbar-search">
                  <div className="completed-task-filter-controls">
                    <div className="completed-task-search-shell d-flex align-items-center">
                      <i className="material-icons completed-task-search-icon">search</i>
                      <input
                        type="text"
                        className="completed-task-search-input"
                        placeholder="Search tasks"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <select
                      className="task-sort-select"
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value)}
                      aria-label="Sort completed tasks"
                    >
                      {TASK_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="completed-task-columns d-flex justify-content-between px-3">
                  <div className="d-flex gap-4 align-items-center">
                      <span className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Task ID</span>
                  </div>
                  <span className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 me-3">Actions</span>
              </div>
            </div>

            <div className="completed-task-panel-body p-0">
              {filteredTasks.length === 0 ? (
                  <div className="text-center py-4 text-muted">No completed tasks found.</div>
              ) : (
                  filteredTasks.map((task, idx) => (
                  <TaskRow 
                      key={task.task_id} 
                      task={task} 
                      isLast={idx === filteredTasks.length - 1}
                      isSelectMode={isSelectMode}
                      isSelected={selectedTaskIds.includes(task.task_id)}
                      isExpanded={isTaskExpanded(task)}
                      isOutputExpanded={isTaskOutputExpanded(task)}
                      onToggleSelect={toggleTaskSelection}
                      onToggleExpanded={(taskId) => updateTaskExpanded(taskId, !isTaskExpanded(task))}
                      onToggleOutput={(taskId) => updateTaskOutputExpanded(taskId, !isTaskOutputExpanded(task))}
                      onCopy={(task) => copyCommand(task, addToast)}
                      onRestart={(task) => restartTask(task.task_id, addToast)}
                      onDownload={(task) => downloadLog(task.task_id, addToast)}
                      onHide={handleHideTask}
                      onDelete={(task) => deleteTask(task.task_id, addToast)}
                          outputLineCount={effectiveOutputLineCount}
                        outputFetchLineCount={outputFetchLineCount}
                        outputShellStyle={outputShellStyle}
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
