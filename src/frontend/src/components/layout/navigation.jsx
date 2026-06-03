import React from "react";

export default function Navbar({ pageTitle, toggleSidebar, actions = null }) {
  return (
    <nav
      className="navbar navbar-main navbar-expand-lg px-0 mx-0 shadow-none border-radius-xl"
      id="navbarBlur"
    >
      <div className="container-fluid py-1 px-0 navbar-page-bar">
        <nav aria-label="breadcrumb" className="navbar-page-title">
          <h4 className="font-weight-bolder mb-0 mt-4">{pageTitle}</h4>
        </nav>

        <div className="navbar-page-actions">
          {actions ? <div className="navbar-page-action-group">{actions}</div> : null}
          <button
            className="nav-link text-body p-3 d-xl-none navbar-sidebar-toggle"
            onClick={toggleSidebar}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <div className="sidenav-toggler-inner">
              <i className="sidenav-toggler-line"></i>
              <i className="sidenav-toggler-line"></i>
              <i className="sidenav-toggler-line"></i>
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}
