import React from "react";
import illustration from "/img/chill_2.png";
import { API_URL } from "../../App";
import { useToast } from "../layout/layout";

export default function QueuedTaskList({ queuedTasks }) {
  const { addToast } = useToast();

  const runQueueAction = async ({ taskId, endpoint, successTitle, errorTitle }) => {
    try {
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: taskId }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(errorTitle, errorText);
        addToast({
          type: "error",
          title: errorTitle,
          message: errorText || undefined,
          delay: 2000,
        });
      } else {
        addToast({
          type: "info",
          title: successTitle,
          delay: 2000,
        });
      }
    } catch (err) {
      console.error(errorTitle, err);
      addToast({
        type: "error",
        title: errorTitle,
        message: String(err),
        delay: 2000,
      });
    }
  };

  return (
    <div className="queued-task-card dashboard-ops-panel">
      <div className="queued-task-card-header">
        <div className="dashboard-ops-header mb-0">
          <div>
            <div className="dashboard-panel-eyebrow">Queue</div>
            <h6 className="dashboard-ops-title">Queued Tasks</h6>
          </div>
          <div className="dashboard-panel-kpis">
            <div className="dashboard-panel-kpi">
              <span className="dashboard-panel-kpi-label">Queued</span>
              <span className="dashboard-panel-kpi-value">{queuedTasks.length}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="queued-task-card-body">
        <ul className="list-group queued-task-list" id="queued_tasks">
          {queuedTasks.length === 0 ? (
            <li className="list-group-item border-0 p-4 mb-2 border-radius-lg text-center text-sm text-muted">
              <img
                src={illustration}
                alt="No running tasks"
                style={{ maxWidth: "200px", opacity: 0.9 }}
              />
              <p className="mt-3 text-muted">No queued task</p>
            </li>
          ) : (
            queuedTasks.map((task) => (
              <li
                key={task.task_id}
                className="list-group-item border-0 d-flex p-4 mb-2 bg-gray-100 border-radius-lg queued-task-row"
              >
                <div className="d-flex flex-column queued-task-content">
                  <h6 className="mb-3 text-sm queued-task-id">{task.task_id}</h6>
                  <span className="mb-2 text-xs queued-task-line">
                    <i>n</i> GPUs:{" "}
                    <span className="text-dark font-weight-bold ms-sm-2">
                      {task.n_gpus}
                    </span>
                  </span>
                  <span className="mb-2 text-xs queued-task-line">
                    Commands:{" "}
                    <span className="text-dark ms-sm-2 font-weight-bold queued-task-value queued-task-value-long">
                      {task.command}
                    </span>
                  </span>
                  <span className="text-xs queued-task-line">
                    Envar:{" "}
                    <span className="text-dark ms-sm-2 font-weight-bold queued-task-value queued-task-value-long">
                      {JSON.stringify(task.envar)}
                    </span>
                  </span>
                </div>

                <div className="ms-auto queued-task-actions d-flex flex-column align-items-center gap-1">
                  <button
                    className="btn btn-link p-2"
                    style={{ minWidth: "20px" }}
                    onClick={async () => {
                      await runQueueAction({
                        taskId: task.task_id,
                        endpoint: "remove_task_from_queue",
                        successTitle: `Task ${task.task_id} removed from queue`,
                        errorTitle: `Task ${task.task_id} could not be removed`,
                      });
                    }}
                    title="Delete Task"
                  >
                    <div className="d-flex justify-content-center align-items-center">
                      <i className="material-icons" style={{ color: "red" }}>
                        delete_outline
                      </i>
                    </div>
                  </button>
                  <button
                    className="btn btn-link p-2"
                    style={{ minWidth: "20px" }}
                    onClick={async () => {
                      await runQueueAction({
                        taskId: task.task_id,
                        endpoint: "promote_task_in_queue",
                        successTitle: `Task ${task.task_id} moved to top`,
                        errorTitle: `Task ${task.task_id} could not be promoted`,
                      });
                    }}
                    title="Move To Top"
                  >
                    <div className="d-flex justify-content-center align-items-center">
                      <i className="material-icons text-dark">vertical_align_top</i>
                    </div>
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
