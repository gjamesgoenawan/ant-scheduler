import React from "react";
import illustration from "/img/chill_2.png";
import { API_URL } from "../../App";
import { useToast } from "../layout/layout";

export default function QueuedTaskList({ queuedTasks }) {
  const { addToast } = useToast();

  return (
    <div className="card">
      <div className="card-header pb-0">
        <h4>Queued Tasks</h4>
      </div>
      <div className="card-body">
        <ul className="list-group" id="queued_tasks">
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
                className="list-group-item border-0 d-flex p-4 mb-2 bg-gray-100 border-radius-lg"
              >
                <div className="d-flex flex-column">
                  <h6 className="mb-3 text-sm">{task.task_id}</h6>
                  <span className="mb-2 text-xs">
                    <i>n</i> GPUs:{" "}
                    <span className="text-dark font-weight-bold ms-sm-2">
                      {task.n_gpus}
                    </span>
                  </span>
                  <span className="mb-2 text-xs">
                    Commands:{" "}
                    <span className="text-dark ms-sm-2 font-weight-bold">
                      {task.command}
                    </span>
                  </span>
                  <span className="text-xs">
                    Envar:{" "}
                    <span className="text-dark ms-sm-2 font-weight-bold">
                      {JSON.stringify(task.envar)}
                    </span>
                  </span>
                </div>

                <div className="ms-auto">
                  <button
                    className="btn btn-link p-2"
                    style={{ minWidth: "20px" }}
                    onClick={async () => {
                      try {
                        const response = await fetch(
                          `${API_URL}/remove_task_from_queue`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ task_ids: task.task_id }),
                          }
                        );
                        if (!response.ok) {
                          const errorText = await response.text();
                          console.error("Failed to remove task from queue", errorText);
                          addToast({
                            type: "error",
                            title: `Task ${task.task_id} could not be removed`,
                            message: errorText || undefined,
                            delay: 2000,
                          });
                        } else {
                          addToast({
                            type: "info",
                            title: `Task ${task.task_id} removed from queue`,
                            delay: 2000,
                          });
                        }
                      } catch (err) {
                        console.error("Error removing task from queue:", err);
                        addToast({
                          type: "error",
                          title: "Remove Failed",
                          message: String(err),
                          delay: 2000,
                        });
                      }
                    }}
                  >
                    <div className="d-flex justify-content-center align-items-center">
                      <i className="material-icons" style={{ color: "red" }}>
                        delete_outline
                      </i>
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
