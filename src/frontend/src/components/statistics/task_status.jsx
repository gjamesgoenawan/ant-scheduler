import React from "react";
import { Link } from 'react-router-dom'; 
import { getTaskSummary } from "../../utils/taskSummary";

export default function TaskStatus({ data }) {
  const summary = getTaskSummary(data);
  const items = [
    { key: "queued", label: "Queued", count: summary.queued, to: "/create_task" },
    { key: "running", label: "Running", count: summary.running, to: "/ongoing_task" },
    { key: "completed", label: "Completed", count: summary.completed, to: "/completed_task" },
  ];
  const totalTasks = summary.tracked;

  return (
    <div className="dashboard-ops-panel dashboard-task-panel">
      <div className="dashboard-ops-header">
        <div>
          <div className="dashboard-panel-eyebrow">Operations</div>
          <h6 className="dashboard-ops-title">Task Status</h6>
        </div>
        <div className="dashboard-panel-kpis">
          <div className="dashboard-panel-kpi">
            <span className="dashboard-panel-kpi-label">Tracked</span>
            <span className="dashboard-panel-kpi-value">{totalTasks}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-task-grid">
        {items.map((item) => (
          <Link key={item.key} to={item.to} className={`dashboard-task-tile dashboard-task-tile-${item.key}`}>
            <div className="dashboard-task-tile-value">{item.count}</div>
            <div className="dashboard-task-tile-label">{item.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
