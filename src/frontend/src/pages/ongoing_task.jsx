import React, { useEffect, useState } from "react";
import Layout, { useToast } from "../components/layout/layout";
import { useMonitorData } from "../App";
import illustration from "/img/chill_1.png";
import OngoingTaskTerminal from "../components/visualization/ongoing_task_terminal";
import { terminateTask } from "../utils/taskActions"; // import the modular function

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
      <div className="container-fluid py-2">
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
              onTerminate={() => terminateTask(task.task_id, addToast)}
            />
          ))
        )}
      </div>
    </Layout>
  );
}
