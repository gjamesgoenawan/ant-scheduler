import React, { useRef, useState } from "react";
import EnvVarEditor from "./envar_editor";
import { API_URL } from "../../App";
import { useToast } from "../layout/layout";
import { fetchWithTimeout } from "../../utils/fetchWithTimeout";

function TaskForm({
  queueMode,
  setQueueMode,
  taskId,
  setTaskId,
  nGpus,
  setNGpus,
  gpuOptions,
  command,
  setCommand,
  envar,
  setEnvar,
  generateUUID64,
}) {
  const envRef = useRef(null);
  const { addToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQueueModeChange = (e) => {
    setQueueMode(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Flush the editor draft first so task creation always uses the latest env values.
      const latestEnvar = envRef.current?.saveNow ? await envRef.current.saveNow() : envar;
      setEnvar(latestEnvar);

      const payload = {
        queue_mode: queueMode,
        task_id: taskId,
        n_gpus: nGpus,
        command: command,
        envar: latestEnvar,
      };

      const response = await fetchWithTimeout(`${API_URL}/create_task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let parsed = null;
        try {
          parsed = await response.json();
        } catch {
        }

      if (!response.ok) {
        
        const msg =
          parsed?.message ??
          `Failed to create task with status ${response.status}`;

        console.error("Failed to create task:", response);
        throw new Error(msg);
      } else {
        const title =
          parsed?.message ??
          parsed?.data ??
          (await response.text().catch(() => "")) ??
          "Task(s) Created!";

        addToast({
          type: "success",
          title: title,
          autohide: true,
          delay: 2000,
        });

        setTaskId(generateUUID64());
        setCommand("");
        setNGpus(1);
      }
    } catch (err) {
      console.error("Error creating task(s):", err);
      addToast({
        type: "error",
        title: `Error creating task(s)`,
        message: String(err) || "",
        autohide: true,
        delay: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form role="form" className="text-start" onSubmit={handleSubmit}>
      <div className="input-group input-group-outline my-3 is-filled">
        <label className="form-label">Queue mode</label>
        <select
          id="queue_mode"
          name="queue_mode"
          className="form-control"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
          value={queueMode}
          onChange={handleQueueModeChange}
          required
        >
          <option>Single</option>
          <option>Multi</option>
        </select>
      </div>
      {queueMode === "Single" && (
        <div className="input-group input-group-outline my-3 is-filled">
          <label className="form-label">Task ID</label>
          <input
            id="task_id"
            name="task_id"
            className="form-control"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            required
          />
        </div>
      )}

      {queueMode === "Single" && (
        <div className="input-group input-group-outline my-3 is-filled">
          <label className="form-label">Number of GPUs</label>
          <select
            id="n_gpus"
            name="n_gpus"
            className="form-control"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
            value={nGpus}
            onChange={(e) => setNGpus(Number(e.target.value))}
            required
          >
            {gpuOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={`input-group input-group-outline mb-3 ${command ? "is-filled" : ""}`}>
        <label className="form-label">Commands</label>
        <textarea
          id="command"
          name="command"
          className="form-control"
          rows="5"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          required
        />
      </div>

      <EnvVarEditor
        ref={envRef}
        onSave={(newEnv) => setEnvar(newEnv)}
        onLoad={(loadedEnv) => setEnvar(loadedEnv)}
      />

      <div className="text-center">
        <button
          type="submit"
          className="btn bg-gradient-primary w-100 my-4 mb-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
