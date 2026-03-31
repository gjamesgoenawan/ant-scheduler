import React, { useEffect, useState } from "react";
import Layout, { useToast } from "../components/layout/layout";
import { useMonitorData } from "../App";
import illustration from "/img/chill_1.png";
import TaskDetail from "../components/visualization/task_detail";
import { copyCommand, terminateTask } from "../utils/taskActions";

export default function OngoingTasks() {
  const { data } = useMonitorData();
  const { addToast } = useToast();
  const [runningTasks, setRunningTasks] = useState([]);

  useEffect(() => {
    if (data?.task_ongoing) {
      setRunningTasks(data.task_ongoing);
    }
  }, [data]);

  return (
    <Layout pageTitle="Ongoing Task">
      <div className="container-fluid py-2 ongoing-task-page">
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
            <div className="row mb-4" key={task.task_id}>
              <TaskDetail
                taskId={task.task_id}
                taskInfo={task}
                titleHref={`/logs?task_id=${task.task_id}`}
                statusContent={<p className="text-sm text-info font-weight-bold mb-0">Running</p>}
                renderHeaderActions={({ showDetails, setShowDetails }) => (
                  <>
                    <button
                      className="btn btn-link text-dark p-2 mb-0 d-flex align-items-center ongoing-task-mobile-toggle"
                      onClick={() => setShowDetails((current) => !current)}
                    >
                      <span className="text-xxs text-uppercase font-weight-bolder me-1">
                        {showDetails ? "Hide" : "Show"}
                      </span>
                      <i className="material-icons text-sm">
                        {showDetails ? "expand_less" : "expand_more"}
                      </i>
                    </button>

                    <button
                      className="btn btn-link text-dark p-2 mb-0"
                      title="Copy Command"
                      onClick={() => copyCommand(task, addToast)}
                    >
                      <i className="material-icons text-lg">copy</i>
                    </button>

                    <button
                      className="btn btn-link text-dark p-2 mb-0"
                      title="Open Log"
                      onClick={() =>
                        window.open(`/logs?task_id=${task.task_id}`, "_blank")
                      }
                    >
                      <i className="material-icons text-lg">open_in_new</i>
                    </button>

                    <button
                      className="btn btn-link text-danger p-2 mb-0 ongoing-task-terminate-btn"
                      title="Terminate Task"
                      onClick={() => terminateTask(task.task_id, addToast)}
                    >
                      <i className="material-icons text-lg">cancel</i>
                    </button>
                  </>
                )}
                outputLabel="Live Output"
                outputType="terminal"
                outputContent={task.console_out.join("\n")}
                collapsible={true}
                defaultExpanded={idx === 0}
              />
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
