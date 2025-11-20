import React from "react";
import { Link } from 'react-router-dom'; 

export default function TaskStatus({ data }) {
  return (
    <div className="card bg-gradient-secondary" style={{width: "100%", height: "100%" }}>
      <div className="card"  style={{width: "100%", height: "100%" }}>
        <div className="card-header pb-0 bg-transparent">
          <h6>Task Status</h6>
        </div>
        <div className="card-body pt-1"
            style={{ verticalAlign: "middle"}} 
        >
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ height: "100%" }} 
          >
            <div className="text-center" style={{ width: "90%" }}>
              <div className="row justify-content-center align-items-center">
                <div
                  className="col-lg-4 col-md- mt-0 mb-2 text-center"
                  style={{ width: "30%" }}
                >
                  <Link to="/create_task" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div>
                      <h1 style={{ marginBottom: 0 }}>
                        {data?.task_queue?.length || 0}
                      </h1>
                      Queued
                    </div>
                  </Link>
                </div>
                <div
                  className="col-lg-4 col-md- mt-0 mb-2 text-center"
                  style={{ width: "30%" }}
                >
                  <Link to="/ongoing_task" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div>
                      <h1 style={{ marginBottom: 0 }}>
                        {data?.task_ongoing?.length || 0}
                      </h1>
                      Running
                    </div>
                  </Link>
                </div>
                <div
                  className="col-lg-4 col-md- mt-0 mb-2 text-center"
                  style={{ width: "30%" }}
                >
                  <Link to="/completed_task" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div>
                      <h1 style={{ marginBottom: 0 }}>
                        {data?.task_completed?.length || 0}
                      </h1>
                      Completed
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
