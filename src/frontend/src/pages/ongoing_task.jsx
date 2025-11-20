import React, { useEffect, useState } from "react";
import Layout, { useToast } from "../components/layout/layout";
import { useMonitorData, API_URL } from "../App";
import illustration from "/img/chill_1.png";
import OngoingTaskTerminal from "../components/visualization/ongoing_task_terminal";

export default function OngoingTasks() {
  const { data } = useMonitorData();
  const { addToast } = useToast();
  const [runningTasks, setRunningTasks] = useState([]);

  const [confirmTaskId, setConfirmTaskId] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (data?.task_ongoing) {
      setRunningTasks(data.task_ongoing);
    }
  }, [data]);

  const handleConfirmTerminate = async () => {
    if (!confirmTaskId) return;
    setIsConfirming(true);
    try {
      const response = await fetch(`${API_URL}/kill_task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task_ids: confirmTaskId }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Failed to kill task", text);

        addToast({
          type: "error",
          title: `Task ${confirmTaskId} could not be terminated`,
          message: text,
          autohide: true,
          delay: 2000,
        });
      } else {
        addToast({
          type: "info",
          title: `Task ${confirmTaskId} Terminated`,
          autohide: true,
          delay: 2000,
        });
        console.log("Task killed successfully");
      }
    } catch (err) {
      console.error("Error killing task:", err);
      addToast({
        type: "error",
        title: "Failed to terminate task",
        message: String(err),
        autohide: true,
        delay: 2000,
      });
    } finally {
      setIsConfirming(false);
      setConfirmTaskId(null);
    }
  };

  return (
    <Layout pageTitle="Ongoing Task">
      <div className="container-fluid py-2">
        {confirmTaskId && (
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmTaskId(null)}
          >
            <div className="confirm-panel" onClick={(e) => e.stopPropagation()}>
              <h5 className="mb-2">Confirm Termination</h5>
              <p className="mb-3">
                Are you sure you want to terminate task{" "}
                <strong>{confirmTaskId}</strong>?
              </p>

              <div className="d-flex justify-content-end">
                <button
                  className="btn btn-secondary me-2"
                  onClick={() => setConfirmTaskId(null)}
                  disabled={isConfirming}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-danger"
                  onClick={handleConfirmTerminate}
                  disabled={isConfirming}
                >
                  {isConfirming ? "Terminating..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {runningTasks.length === 0 ? (
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ minHeight: "80vh" }}
          >
            <div className="text-center">
              <img
                src={illustration}
                alt="No running tasks"
                style={{ maxWidth: "200px", opacity: 0.9 }}
              />
              <p className="mt-3 text-muted">No running tasks</p>
            </div>
          </div>
        ) : (
          runningTasks.map((task, idx) => (
            <OngoingTaskTerminal
              key={task.task_id}
              task={task}
              idx={idx}
              onTerminate={setConfirmTaskId}
            />
          ))
        )}
      </div>
    </Layout>
  );
}