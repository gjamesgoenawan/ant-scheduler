import { API_URL } from "../App";

// build command
export const buildAntCommand = (task) => {
  if (!task) return "";

  return (
    `ant_task_id=${task.task_id} ` +
    `ant_n_gpus=${task.n_gpus} ` +
    `ant_envar=${JSON.stringify(task.envar)} ` +
    `${task.command}`
  );
};

// copy command
export const copyCommand = async (task, addToast) => {
  const command = buildAntCommand(task);
  if (!command) return;

  await navigator.clipboard.writeText(command);

  addToast({
    type: "success",
    title: "Command Copied!",
    autohide: true,
    delay: 2000,
  });
};

// download log
export const downloadLog = async (taskId, addToast) => {
  try {
    const response = await fetch(
      `${API_URL}/get_log_file?task_id=${taskId}`,
      { method: "GET" }
    );

    const contentType = response.headers.get("Content-Type") || "";
    if (!response.ok || contentType.includes("json")) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Failed to download log");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${taskId}.ant.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  } catch (err) {
    addToast({
      type: "error",
      title: "Download Failed",
      message: String(err),
      autohide: true,
      delay: 3000,
    });
  }
};

// delete task
export const deleteTask = async (taskId, addToast) => {
  if (!window.confirm(`Delete task ${taskId}?`)) return;

  try {
    const res = await fetch(`${API_URL}/remove_task_from_history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_ids: taskId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Delete Task failed with status ${res.status}`);
    }

    addToast({
      type: "info",
      title: "Task Deleted",
      message: `Task ${taskId} removed`,
      autohide: true,
      delay: 2000,
    });
  } catch (err) {
    addToast({
      type: "error",
      title: "Delete Failed",
      message: String(err),
      autohide: true,
      delay: 3000,
    });
  }
};

// terminate
export const terminateTask = async (taskId, addToast) => {
  if (!window.confirm(`Are you sure you want to terminate task ${taskId}?`)) return;

  try {
    const res = await fetch(`${API_URL}/kill_task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_ids: taskId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Terminate Task failed with status ${res.status}`);
    }

    addToast({
      type: "info",
      title: "Task Terminated",
      message: `Task ${taskId} has been terminated`,
      autohide: true,
      delay: 2000,
    });
  } catch (err) {
    addToast({
      type: "error",
      title: "Termination Failed",
      message: String(err),
      autohide: true,
      delay: 3000,
    });
  }
};

// restart
export const restartTask = async (taskId, addToast) => {
  try {
    const res = await fetch(
      `${API_URL}/restart_task?task_id=${taskId}`,
      { method: "GET" }
    );
    
    let parsed = null;
    try {
      parsed = await res.json();      
    } catch {
    }
  
    if (!res.ok) {
      console.error("Failed to create task:", res);
      throw new Error(parsed?.message || `Restart Task failed with status ${res.status}`);
    }

    addToast({
      type: "success",
      title: "Task Restarted!",
      message: parsed.message,
      autohide: true,
      delay: 2000,
    })
  } catch (err) {
    addToast({
      type: "error",
      title: "Restart Task Failed",
      message: String(err),
      autohide: true,
      delay: 3000,
    });
  }
};
