import React, { useEffect, useState } from "react";
import { useMonitorData, API_URL } from "../App";

import Layout, { useToast } from "../components/layout/layout";
import QueuedTaskList from "../components/create_task/queued_task";
import TaskForm from "../components/create_task/task_form";
import TaskStatus from "../components/statistics/task_status";
import GpuToggleList from "../components/statistics/gpu_toggle";

function generateUUID64() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function CreateTask() {
  const { data } = useMonitorData();
  const [queueMode, setQueueMode] = useState("Single");
  const [taskId, setTaskId] = useState(generateUUID64() || "");
  const [nGpus, setNGpus] = useState(1);
  const [gpuOptions, setGpuOptions] = useState([]);
  const [command, setCommand] = useState("");
  const [envar, setEnvar] = useState("");
  const [queuedTasks, setQueuedTasks] = useState([]);
  const [createErrorMessage, setCreateErrorMessage] = useState("");

  useEffect(() => {
    if (data?.task_completed && data.monitor?.gpu_name) {
      const gpuCount = data.monitor.gpu_name.length;
      setGpuOptions(Array.from({ length: gpuCount + 1 }, (_, i) => i));
      setQueuedTasks(data.task_queue || []);
    }
  }, [data]);

  const showCreateErrorToast = (msg) => {
  const text = Array.isArray(msg) ? msg.join("\n") : String(msg || "");
  setCreateErrorMessage(text);

  const bodyEl = document.getElementById("create-error-toast-body");
  if (bodyEl) bodyEl.textContent = text;

  const errorEl = document.getElementById("create-error-toast");
  const successEl = document.getElementById("create-success-toast");

  if (!errorEl) return;
  if (successEl) {
    const successToast = window.bootstrap?.Toast.getOrCreateInstance(successEl);
    successToast?.hide();
  }

  const errorToast = window.bootstrap?.Toast.getOrCreateInstance(errorEl, {
    autohide: true,
    delay: 2000,
  });

  errorToast?.show();

  const onHidden = () => {
    setCreateErrorMessage("");
    errorEl.removeEventListener("hidden.bs.toast", onHidden);
  };
  errorEl.addEventListener("hidden.bs.toast", onHidden);
};

const showCreateSuccessToast = () => {
  const successEl = document.getElementById("create-success-toast");
  const errorEl = document.getElementById("create-error-toast");

  if (!successEl) return;
  if (errorEl) {
    const errorToast = window.bootstrap?.Toast.getOrCreateInstance(errorEl);
    errorToast?.hide();
  }

  const successToast = window.bootstrap?.Toast.getOrCreateInstance(successEl, {
    autohide: true,
    delay: 2000,
  });

  successToast?.show();
};

  return (
    <Layout pageTitle="Create New Task" maxToasts={2}>
      <div className="container-fluid py-2">
        <div className="row">
          {/* Task Form */}
          <div className="card mb-4">
            <div className="card-body">
              <TaskForm
                queueMode={queueMode}
                setQueueMode={setQueueMode}
                taskId={taskId}
                setTaskId={setTaskId}
                nGpus={nGpus}
                setNGpus={setNGpus}
                gpuOptions={gpuOptions}
                command={command}
                setCommand={setCommand}
                envar={envar}
                setEnvar={setEnvar}
                generateUUID64={generateUUID64}
                showCreateErrorToast={showCreateErrorToast}
                showCreateSuccessToast={showCreateSuccessToast}
              />
            </div>
          </div>
        </div>
        <div className="row mb-4">
          <div className="col-lg-6 col-md-6"
            style={{ paddingLeft: '0px',
                    paddingRight: '0.75rem',
                    height: '250px'}}>
            <TaskStatus data={data} />
          </div>
          <div className="col-lg-6 col-md-6"
            style={{ paddingLeft: '0.75 rem',
                    paddingRight: '0px',
                    height: '250px'}}>
            <GpuToggleList data={data} /> 
          </div>
        </div>
        
        <div className="row mb-4">
          <QueuedTaskList queuedTasks={queuedTasks} />
        </div>
      </div>
    </Layout>
  );
}
