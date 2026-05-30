import React, { useEffect, useState } from "react";

import {
  readStoredBoolean,
  writeStoredValue,
} from "../../utils/persistedTaskState";

const DEFAULT_STORAGE_KEY = "antScheduler.createTask.taskIdTemplateHelpExpanded";
const TASK_ID_TEMPLATE_TOKENS = [
  "[uuid]",
  "[uuid8]",
  "[date]",
  "[time]",
  "[datetime]",
  "[random_phrase]",
  "[randint:1000:9999]",
];

export default function TaskIdTemplateHelp({
  compact = false,
  defaultExpanded = true,
  storageKey = DEFAULT_STORAGE_KEY,
}) {
  const [isExpanded, setIsExpanded] = useState(() =>
    readStoredBoolean(storageKey, defaultExpanded)
  );

  useEffect(() => {
    writeStoredValue(storageKey, isExpanded);
  }, [isExpanded, storageKey]);

  return (
    <div
      className={`task-id-template-help ${compact ? "task-id-template-help-compact" : ""} ${
        isExpanded ? "" : "task-id-template-help-collapsed"
      }`}
    >
      <button
        type="button"
        className="task-id-template-help-header"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <span className="task-id-template-help-title">Task ID Templates</span>
        <span className="task-id-template-help-toggle">
          <i className="material-icons text-sm">{isExpanded ? "expand_less" : "expand_more"}</i>
        </span>
      </button>

      {isExpanded ? (
        <div className="task-id-template-help-body">
          <p className="task-id-template-help-copy mb-0">
            Use the same placeholders in both <code>Task ID</code> and <code>ant_task_id</code>. Example:
            <span className="task-id-template-help-example"> experiment-[random_phrase]-[uuid8]</span>
          </p>
          <div className="task-id-template-token-list">
            {TASK_ID_TEMPLATE_TOKENS.map((token) => (
              <span key={token} className="task-id-template-token">
                {token}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}