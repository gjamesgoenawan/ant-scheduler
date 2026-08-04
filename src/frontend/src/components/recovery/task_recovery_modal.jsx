import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../App";
import { useToast } from "../layout/layout";
import { fetchWithTimeout } from "../../utils/fetchWithTimeout";
import { taskMatchesSearch } from "../../utils/taskSearch";
import { sortTasks, TASK_SORT_OPTIONS } from "../../utils/taskSort";

const SECTION_LABELS = {
  ongoing: "Interrupted Ongoing Tasks",
  queued: "Queued Tasks",
  completed: "Completed Tasks",
  hidden: "Hidden Tasks",
};

const SHORT_SECTION_LABELS = {
  ongoing: "Interrupted",
  queued: "Queued",
  completed: "Completed",
  hidden: "Hidden",
};

function recoveryTime(savedAt) {
  if (!savedAt) return "-";
  return new Date(savedAt * 1000).toLocaleString();
}

function countSessionTasks(session) {
  if (!session) return 0;
  return ["ongoing", "queued", "completed"].reduce(
    (total, section) => total + (session[section]?.length || 0),
    0
  );
}

function normalizeRecoveryPayload(payload) {
  if (!payload) return payload;
  if (payload.last_session !== undefined || payload.earlier_sessions !== undefined) {
    return payload;
  }

  return {
    ...payload,
    last_session: {
      session_id: "legacy-session",
      saved_at: payload.saved_at,
      ongoing: payload.ongoing || [],
      queued: payload.queued || [],
      completed: payload.completed || [],
    },
    earlier_sessions: [],
  };
}

async function recoveryResponseError(response) {
  const payload = await response.json().catch(() => null);
  return new Error(payload?.message || `Recovery request failed with status ${response.status}`);
}

function taskKey(task) {
  return task.recovery_key || `${task.session_id}:${task.section}:${task.task_id}`;
}

function taskEntry(task) {
  return {
    session_id: task.session_id,
    section: task.section,
    task_id: task.task_id,
  };
}

function sessionTasks(session, section) {
  return session?.[section] || [];
}

function sessionsForTab(recovery, activeTab) {
  if (!recovery) return [];
  if (activeTab === "last") return recovery.last_session ? [recovery.last_session] : [];
  if (activeTab === "hidden") {
    return [{ session_id: "hidden", hidden: recovery.hidden_tasks || [] }];
  }
  return recovery.earlier_sessions || [];
}

function RecoverySection({ title, tasks, selectedKeys, onToggle, onDelete, onHide, deletingKey, hidingKey }) {
  if (!tasks?.length) return null;

  return (
    <section className="task-recovery-section">
      <div className="task-recovery-section-title">{title}</div>
      <div className="task-recovery-list">
        {tasks.map((task) => {
          const key = taskKey(task);
          const checked = selectedKeys.includes(key);
          const isDeleting = deletingKey === key;
          const isHiding = hidingKey === key;

          return (
            <div className="task-recovery-item" key={key}>
              <button
                type="button"
                className="task-recovery-check-button"
                aria-pressed={checked}
                onClick={() => onToggle(task)}
              >
                <i className="material-icons task-recovery-check-icon">
                  {checked ? "check_box" : "check_box_outline_blank"}
                </i>
              </button>
              <span className="task-recovery-item-body" onClick={() => onToggle(task)}>
                <span className="task-recovery-item-top">
                  <span className="task-recovery-task-id">{task.task_id}</span>
                  <span className="task-recovery-status">{task.status}</span>
                </span>
                <span className="task-recovery-meta">
                  {task.start_time} - {task.duration} - {task.n_gpus} GPU
                </span>
                <span className="task-recovery-command">{task.command}</span>
              </span>
              {task.section !== "hidden" ? (
                <button
                  type="button"
                  className="btn btn-link text-secondary p-2 mb-0 task-recovery-hide-button"
                  title="Hide Task"
                  disabled={isHiding}
                  onClick={() => onHide(task)}
                >
                  <i className="material-icons text-lg">visibility_off</i>
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-link text-danger p-2 mb-0 task-recovery-delete-button"
                title="Delete From Recovery History"
                disabled={isDeleting}
                onClick={() => onDelete(task)}
              >
                <i className="material-icons text-lg">delete_outline</i>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecoverySession({ session, sections = ["ongoing", "queued", "completed"], selectedKeys, onToggle, onDelete, onHide, deletingKey, hidingKey, showHeader }) {
  const taskCount = sections.reduce((total, section) => total + sessionTasks(session, section).length, 0);
  if (!session || taskCount === 0) return null;

  return (
    <div className="task-recovery-session">
      {showHeader ? (
        <div className="task-recovery-session-header">
          <span className="task-recovery-session-time">{recoveryTime(session.saved_at)}</span>
          <span className="task-recovery-session-count">{taskCount} tasks</span>
        </div>
      ) : null}
      {sections.map((section) => (
        <RecoverySection
          key={section}
          title={SECTION_LABELS[section]}
          tasks={sessionTasks(session, section)}
          selectedKeys={selectedKeys}
          onToggle={onToggle}
          onDelete={onDelete}
          onHide={onHide}
          deletingKey={deletingKey}
          hidingKey={hidingKey}
        />
      ))}
    </div>
  );
}

export default function TaskRecoveryModal() {
  const { addToast } = useToast();
  const [recovery, setRecovery] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [activeTab, setActiveTab] = useState("last");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [hidingKey, setHidingKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
    const [sortMode, setSortMode] = useState("completed-desc");
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const [error, setError] = useState(null);

  const loadRecoveryState = async ({ consumePrompt = false } = {}) => {
    const response = await fetchWithTimeout(`${API_URL}/recovery_state?consume_prompt=${consumePrompt ? "true" : "false"}`);
    if (!response.ok) {
      throw await recoveryResponseError(response);
    }
    const payload = await response.json();
    return normalizeRecoveryPayload(payload?.data || payload);
  };

  useEffect(() => {
    let cancelled = false;

    loadRecoveryState({ consumePrompt: true })
      .then((recoveryPayload) => {
        if (cancelled) return;
        setRecovery(recoveryPayload);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(String(fetchError.message || fetchError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const openRecovery = () => {
      setLoading(true);
      setError(null);
      loadRecoveryState({ consumePrompt: false })
        .then((payload) => {
          setRecovery(payload);
          setManuallyOpened(true);
        })
        .catch((fetchError) => setError(String(fetchError.message || fetchError)))
        .finally(() => setLoading(false));
    };
    window.addEventListener("ant:open-recovery", openRecovery);
    return () => window.removeEventListener("ant:open-recovery", openRecovery);
  }, []);

  const activeSections = activeTab === "hidden" ? ["hidden"] : ["ongoing", "queued", "completed"];
  const activeSessions = useMemo(() => sessionsForTab(recovery, activeTab).map((session) => ({
    ...session,
    ...Object.fromEntries(activeSections.map((section) => [
      section,
      sortTasks(
        sessionTasks(session, section).filter((task) => taskMatchesSearch(task, searchQuery)),
        sortMode
      ),
    ])),
  })), [recovery, activeTab, searchQuery, sortMode]);

  const activeTabTasks = useMemo(
    () => activeSessions.flatMap((session) => activeSections.flatMap((section) => sessionTasks(session, section))),
    [activeSessions]
  );

  const selectedEntries = useMemo(() => {
    const byKey = new Map();
    const allSessions = [recovery?.last_session, ...(recovery?.earlier_sessions || []), { hidden: recovery?.hidden_tasks || [] }].filter(Boolean);
    allSessions.forEach((session) => {
      ["ongoing", "queued", "completed", "hidden"].forEach((section) => {
        sessionTasks(session, section).forEach((task) => byKey.set(taskKey(task), taskEntry(task)));
      });
    });
    return selectedKeys.map((key) => byKey.get(key)).filter(Boolean);
  }, [recovery, selectedKeys]);

  const hasSelection = selectedEntries.length > 0;

  const toggleTask = (task) => {
    const key = taskKey(task);
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key]
    );
  };

  const toggleSection = (section) => {
    const sectionKeys = activeSessions.flatMap((session) => sessionTasks(session, section).map(taskKey));
    if (sectionKeys.length === 0) return;

    const allSelected = sectionKeys.every((key) => selectedKeys.includes(key));
    setSelectedKeys((current) => {
      if (allSelected) {
        return current.filter((key) => !sectionKeys.includes(key));
      }
      return Array.from(new Set([...current, ...sectionKeys]));
    });
  };

  const sectionButtonLabel = (section) => {
    const sectionKeys = activeSessions.flatMap((session) => sessionTasks(session, section).map(taskKey));
    if (sectionKeys.length === 0) return SHORT_SECTION_LABELS[section];
    const allSelected = sectionKeys.every((key) => selectedKeys.includes(key));
    return `${allSelected ? "Unselect" : "Select"} ${SHORT_SECTION_LABELS[section]}`;
  };

  const closeRecovery = async () => {
    setSubmitting(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/dismiss_recovery`, { method: "POST" });
      if (!response.ok) throw await recoveryResponseError(response);
      setRecovery(null);
      setManuallyOpened(false);
      addToast({ type: "info", title: "Recovery kept for later", delay: 2000 });
    } catch (dismissError) {
      setError(String(dismissError.message || dismissError));
    } finally {
      setSubmitting(false);
    }
  };

  const hideRecoveryTask = async (task) => {
    const key = taskKey(task);
    setHidingKey(key);
    try {
      const response = await fetchWithTimeout(`${API_URL}/hide_recovery_tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [taskEntry(task)] }),
      });
      if (!response.ok) throw await recoveryResponseError(response);
      setSelectedKeys((current) => current.filter((selectedKey) => selectedKey !== key));
      setRecovery(await loadRecoveryState({ consumePrompt: false }));
      addToast({ type: "info", title: `Hidden ${task.task_id}`, delay: 2000 });
    } catch (hideError) {
      setError(String(hideError.message || hideError));
    } finally {
      setHidingKey(null);
    }
  };

  const deleteRecoveryTask = async (task) => {
    const key = taskKey(task);
    setDeletingKey(key);
    try {
      const response = await fetchWithTimeout(`${API_URL}/delete_recovery_tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [taskEntry(task)] }),
      });
      if (!response.ok) throw await recoveryResponseError(response);
      setSelectedKeys((current) => current.filter((selectedKey) => selectedKey !== key));
      const nextRecovery = await loadRecoveryState({ consumePrompt: false });
      setRecovery(nextRecovery);
      addToast({ type: "info", title: `Removed ${task.task_id} from recovery`, delay: 2000 });
    } catch (deleteError) {
      setError(String(deleteError.message || deleteError));
    } finally {
      setDeletingKey(null);
    }
  };

  const restoreRecovery = async () => {
    setSubmitting(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/restore_recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: selectedEntries }),
      });
      if (!response.ok) throw await recoveryResponseError(response);
      setRecovery(null);
      setManuallyOpened(false);
      addToast({ type: "success", title: "Tasks restored", delay: 2200 });
    } catch (restoreError) {
      setError(String(restoreError.message || restoreError));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (!recovery?.pending && !manuallyOpened)) return null;

  const lastCount = countSessionTasks(recovery.last_session);
  const earlierCount = (recovery.earlier_sessions || []).reduce(
    (total, session) => total + countSessionTasks(session),
    0
  );
  const hiddenCount = recovery.hidden_tasks?.length || 0;

  return (
    <div className="task-recovery-backdrop" role="dialog" aria-modal="true">
      <div className="task-recovery-modal">
        <div className="task-recovery-header">
          <div>
            <div className="dashboard-panel-eyebrow">Recovery</div>
            <h5 className="task-recovery-title mb-0">Restore Tasks</h5>
          </div>
          <span className="task-recovery-saved-at">
            {recoveryTime(recovery.last_session?.saved_at)}
          </span>
        </div>

        <div className="task-recovery-tabs" role="tablist">
          <button
            type="button"
            className={`task-recovery-tab ${activeTab === "last" ? "task-recovery-tab-active" : ""}`}
            onClick={() => setActiveTab("last")}
          >
            Last Session <span>{lastCount}</span>
          </button>
          <button
            type="button"
            className={`task-recovery-tab ${activeTab === "earlier" ? "task-recovery-tab-active" : ""}`}
            onClick={() => setActiveTab("earlier")}
          >
            Earlier Sessions <span>{earlierCount}</span>
          </button>
          <button
            type="button"
            className={`task-recovery-tab ${activeTab === "hidden" ? "task-recovery-tab-active" : ""}`}
            onClick={() => setActiveTab("hidden")}
          >
            Hidden Tasks <span>{hiddenCount}</span>
          </button>
        </div>

        <div className="task-recovery-search">
          <div className="task-recovery-search-input-wrap">
            <i className="material-icons">search</i>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search ID, command, status, environment, time, GPU..."
              aria-label="Search recovery tasks"
            />
          </div>
          <select
            className="task-sort-select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            aria-label="Sort recovery tasks"
          >
            {TASK_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {error ? <div className="alert alert-danger py-2 mx-3 mt-3 mb-0">{error}</div> : null}

        <div className="task-recovery-body">
          {activeTabTasks.length === 0 ? (
            <div className="task-recovery-empty">No recovery tasks in this tab.</div>
          ) : (
            activeSessions.map((session) => (
              <RecoverySession
                key={session.session_id}
                session={session}
                sections={activeSections}
                selectedKeys={selectedKeys}
                onToggle={toggleTask}
                onDelete={deleteRecoveryTask}
                onHide={hideRecoveryTask}
                deletingKey={deletingKey}
                hidingKey={hidingKey}
                showHeader={activeTab === "earlier" || activeSessions.length > 1}
              />
            ))
          )}
        </div>

        <div className="task-recovery-bulk-actions">
          {activeSections.map((section) => (
            <button key={section} type="button" className="btn btn-outline-dark mb-0" onClick={() => toggleSection(section)}>
              {sectionButtonLabel(section)}
            </button>
          ))}
        </div>

        <div className="task-recovery-footer">
          <button
            type="button"
            className="btn btn-outline-secondary mb-0"
            disabled={submitting}
            onClick={closeRecovery}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-dark mb-0"
            disabled={submitting || !hasSelection}
            onClick={restoreRecovery}
          >
            Restore Selected
          </button>
        </div>
      </div>
    </div>
  );
}
