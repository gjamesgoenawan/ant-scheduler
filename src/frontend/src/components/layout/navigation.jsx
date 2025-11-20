import React from "react";

export default function Navbar({ pageTitle, toggleSidebar }) {
  return (
    <nav
      className="navbar navbar-main navbar-expand-lg px-0 mx-0 shadow-none border-radius-xl"
      id="navbarBlur"
    >
      <div className="container-fluid py-1 px-0">
        <nav aria-label="breadcrumb">
          <h4 className="font-weight-bolder mb-0 mt-4">{pageTitle}</h4>
        </nav>

        <div className="collapse navbar-collapse justify-content-end align-items-center">
          <ul className="navbar-nav justify-content-end">
            <li className="nav-item d-xl-none ps-3 d-flex mt-3 align-items-center">
              <button
                className="nav-link text-body p-3"
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
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
