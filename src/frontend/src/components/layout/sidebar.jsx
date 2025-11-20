import React from "react";
import { NavLink } from "react-router-dom";
import logo from "/img/logo-ct.png"; // Copy your logo here

export default function Sidebar({ pinned }) {
  return (
    <aside
      className="sidenav navbar navbar-vertical navbar-expand-xs border-0 border-radius-xl my-3 fixed-start ms-3 bg-gradient-dark"
      id="sidenav-main"
    >
      <div className="sidenav-header position-relativ">
        <i
          className="fas fa-times p-3 cursor-pointer text-white opacity-5 position-absolute end-0 top-0 d-none d-xl-none"
          aria-hidden="true"
          id="iconSidenav"
        ></i>
        <a className="navbar-brand m-1" href="/" target="_blank" rel="noreferrer">
          <img src={logo} className="navbar-brand-img h-100" alt="main_logo" />
          <span className="ms-1 font-weight-bold text-white">ANT Scheduler</span>
        </a>
      </div>

      <hr className="horizontal light mt-0 mb-2" />

      <div className="collapse navbar-collapse w-auto" id="sidenav-collapse-main"
        style = {{ minHeight: "min(200px, 50vh)" }}
      >

        <ul className="navbar-nav">
          <li className="nav-item">
            <NavLink
              to="/home"
              className={({ isActive }) =>
                "nav-link text-white" + (isActive ? " active bg-gradient-primary" : "")
              }
            >
              <div className="text-white text-center me-2 d-flex align-items-center justify-content-center">
                <i className="material-icons opacity-10">dashboard</i>
              </div>
              <span className="nav-link-text ms-1">Dashboard</span>
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/ongoing_task"
              className={({ isActive }) =>
                "nav-link text-white" + (isActive ? " active bg-gradient-primary" : "")
              }
            >
              <div className="text-white text-center me-2 d-flex align-items-center justify-content-center">
                <i className="material-icons opacity-10">table_view</i>
              </div>
              <span className="nav-link-text ms-1">Ongoing Tasks</span>
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/completed_task"
              className={({ isActive }) =>
                "nav-link text-white" + (isActive ? " active bg-gradient-primary" : "")
              }
            >
              <div className="text-white text-center me-2 d-flex align-items-center justify-content-center">
                <i className="material-icons opacity-10">checklist</i>
              </div>
              <span className="nav-link-text ms-1">Completed Tasks</span>
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/create_task"
              className={({ isActive }) =>
                "nav-link text-white" + (isActive ? " active bg-gradient-primary" : "")
              }
            >
              <div className="text-white text-center me-2 d-flex align-items-center justify-content-center">
                <i className="material-icons opacity-10">view_in_ar</i>
              </div>
              <span className="nav-link-text ms-1">Create New Task</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </aside>
  );
}
