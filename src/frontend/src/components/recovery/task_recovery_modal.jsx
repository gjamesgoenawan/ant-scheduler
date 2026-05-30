import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../App";
import { useToast } from "../layout/layout";

const emptySelection = {
  ongoing_task_ids: [],
  queued_task_ids: [],
  completed_task_ids: [],
};

function allTaskIds(tasks = []) {
  return tasks.map((task) => task.task_id);
}

function recoveryTime(savedAt) {
  if (!savedAt) return "-";
  return new Date(savedAt * 1000).toLocaleString();
}

function RecoverySection({ title, tasks, selectedIds, onToggle }) {
  if (!tasks?.length) return null;

  return (
    <section className="task-recovery-section">
      <div className="task-recovery-section-title">{title}</div>
      <div className="task-recovery-list">
        {tasks.map((task) => {
          const checked = selectedIds.includes(task.task_id);
          return (
            <label className="task-recovery-item" key={`${title}-${task.task_id}`}>
              <input
                type="checkbox"
                className="form-check-input task-recovery-checkbox"
                checked={checked}
                onChange={() => onToggle(task.task_id)}
              />
              <span className="task-recovery-item-body">
                <span className="task-recovery-item-top">
                  <span className="task-recovery-task-id">{task.task_id}</span>
                  <span className="task-recovery-status">{task.status}</span>
                </span>
                <span className="task-recovery-meta">
                  {task.start_time} - {task.duration} - {task.n_gpus} GPU
                </span>
                <span className="task-recovery-command">{task.command}</span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default function TaskRecoveryModal() {
  const { addToast } = useToast();
  const [recovery, setRecovery] = useState(null);
  const [selection, setSelection] = useState(emptySelection);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/recovery_state`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const recoveryPayload = payload?.data || payload;
        setRecovery(recoveryPayload);
        if (recoveryPayload?.pending) {
          setSelection({
            ongoing_task_ids: allTaskIds(recoveryPayload.ongoing),
            queued_task_ids: allTaskIds(recoveryPayload.queued),
            completed_task_ids: allTaskIds(recoveryPayload.completed),
          });
        }
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

  const hasSelection = useMemo(
    () => Object.values(selection).some((ids) => ids.length > 0),
    [selection]
  );

  const toggleSelection = (key, taskId) => {
    setSelection((current) => {
      const selectedIds = current[key] || [];
      const nextIds = selectedIds.includes(taskId)
        ? selectedIds.filter((id) => id !== taskId)
        : [...selectedIds, taskId];
      return { ...current, [key]: nextIds };
    });
  };

  const dismissRecovery = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/dismiss_recovery`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      setRecovery(null);
      addToast({ type: "info", title: "Recovery dismissed", delay: 2000 });
    } catch (dismissError) {
      setError(String(dismissError.message || dismissError));
    } finally {
      setSubmitting(false);
    }
  };

  const restoreRecovery = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/restore_recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      if (!response.ok) throw new Error(await response.text());
      setRecovery(null);
      addToast({ type: "success", title: "Tasks restored", delay: 2200 });
    } catch (restoreError) {
      setError(String(restoreError.message || restoreError));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !recovery?.pending) return null;

  return (
    <div className="task-recovery-backdrop" role="dialog" aria-modal="true">
      <div className="task-recovery-modal">
        <div className="task-recovery-header">
          <div>
            <div className="dashboard-panel-eyebrow">Recovery</div>
            <h5 className="task-recovery-title mb-0">Restore Tasks</h5>
          </div>
          <span className="task-recovery-saved-at">{recoveryTime(recovery.saved_at)}</span>
        </div>

        {error ? <div className="alert alert-danger py-2 mb-3">{error}</div> : null}

        <div className="task-recovery-body">
          <RecoverySection
            title="Interrupted Ongoing Tasks"
            tasks={recovery.ongoing}
            selectedIds={selection.ongoing_task_ids}
            onToggle={(taskId) => toggleSelection("ongoing_task_ids", taskId)}
          />
          <RecoverySection
            title="Queued Tasks"
            tasks={recovery.queued}
            selectedIds={selection.queued_task_ids}
            onToggle={(taskId) => toggleSelection("queued_task_ids", taskId)}
          />
          <RecoverySection
            title="Completed Tasks"
            tasks={recovery.completed}
            selectedIds={selection.completed_task_ids}
            onToggle={(taskId) => toggleSelection("completed_task_ids", taskId)}
          />
        </div>

        <div className="task-recovery-footer">
          <button
            type="button"
            className="btn btn-outline-secondary mb-0"
            disabled={submitting}
            onClick={dismissRecovery}
          >
            Dismiss
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