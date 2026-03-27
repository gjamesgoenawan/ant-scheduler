import React from "react";
import { Link } from 'react-router-dom'; 

export default function TaskStatus({ data }) {
  const items = [
    { key: "queued", label: "Queued", count: data?.task_queue?.length || 0, to: "/create_task" },
    { key: "running", label: "Running", count: data?.task_ongoing?.length || 0, to: "/ongoing_task" },
    { key: "completed", label: "Completed", count: data?.task_completed?.length || 0, to: "/completed_task" },
  ];
  const totalTasks = items.reduce((sum, item) => sum + item.count, 0);

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
