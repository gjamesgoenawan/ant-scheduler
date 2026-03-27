import React from "react";
import { Link } from 'react-router-dom'; 

export default function TaskStatus({ data }) {
  const items = [
    { label: "Queued", count: data?.task_queue?.length || 0, to: "/create_task" },
    { label: "Running", count: data?.task_ongoing?.length || 0, to: "/ongoing_task" },
    { label: "Completed", count: data?.task_completed?.length || 0, to: "/completed_task" },
  ];

  return (
    <div className="card bg-gradient-secondary task-status-shell">
      <div className="card task-status-inner">
        <div className="card-header pb-0 bg-transparent">
          <h6>Task Status</h6>
        </div>
        <div className="card-body pt-1 task-status-body">
          <div className="d-flex justify-content-center align-items-center task-status-content">
            <div className="text-center task-status-grid-shell">
              <div className="row justify-content-center align-items-center task-status-grid">
                {items.map((item) => (
                  <div key={item.label} className="col-lg-4 col-md- mt-0 mb-2 text-center task-status-item">
                    <Link to={item.to} className="task-status-link-reset">
                      <div className="task-status-link">
                        <h1 className="task-status-count">{item.count}</h1>
                        <div className="task-status-label">{item.label}</div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
