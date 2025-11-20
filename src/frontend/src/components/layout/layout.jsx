// src/components/Layout.jsx
import React, { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import Navbar from "./navigation";
import { useToast } from "./toasts";

import "../../assets/css/fonts.css";
import "../../assets/css/styles.css";
import "../../assets/js/scripts.js";

const SIDEBAR_THRESHOLD = 1200; // same as the JS logic

export { useToast };

export default function Layout({ children, pageTitle }) {
  const [messages, setMessages] = useState([]);
  const [sidebarPinned, setSidebarPinned] = useState(window.innerWidth > SIDEBAR_THRESHOLD);

  // Toggle sidebar pinned state manually
  const toggleSidebar = () => setSidebarPinned(prev => !prev);

  useEffect(() => {
    // Set the browser's document title
    document.title = pageTitle;
  }, []);

  // Auto-update pinned state based on window width
  useEffect(() => {
    const handleResize = () => setSidebarPinned(window.innerWidth > SIDEBAR_THRESHOLD);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync body class with sidebarPinned
  useEffect(() => {
    const body = document.body;
    const sidenav = document.getElementById("sidenav-main");

    if (sidebarPinned) {
      body.classList.add("g-sidenav-pinned");
    } else {
      body.classList.remove("g-sidenav-pinned");
    }
  }, [sidebarPinned]);

  return (
      <div className={`g-sidenav-show bg-gray-200 ${sidebarPinned ? "g-sidenav-pinned" : "g-sidenav-hidden"}`}>
        <Sidebar pinned={sidebarPinned} />
        <main className="main-content position-relative border-radius-lg">
          <div className="container-fluid bg-gray-200" style={{ minHeight: "100vh" }}>
            <Navbar pageTitle={pageTitle} toggleSidebar={toggleSidebar} />
            {children}
          </div>
        </main>
      </div>
  );
}
