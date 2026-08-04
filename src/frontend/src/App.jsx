import { lazy, Suspense, useEffect, useState, createContext, useContext } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { io } from "socket.io-client";

import * as bootstrap from 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import { ToastProvider } from "./components/layout/toasts";
import Home from "./pages/home";
import OngoingTask from "./pages/ongoing_task";
import CompletedTask from "./pages/completed_task";
import CreateTask from "./pages/create_task";
import Logs from "./pages/logs";
import NotFound from "./pages/404";
import TaskRecoveryModal from "./components/recovery/task_recovery_modal";

const TerminalPage = lazy(() => import("./pages/terminal"));

const DataContext = createContext(null);

export function useMonitorData() {
  return useContext(DataContext);
}
export const API_URL = `/api`;
export const SOCKETIO_URL = '/';

// dwbug
// export const API_URL = 'http://localhost:5000/';
// export const SOCKETIO_URL = 'http://localhost:5000/';


const socket = io(SOCKETIO_URL, {
  transports: ["polling", "websocket"],
  upgrade: true,
  timeout: 8000,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
});

function App() {
  const [data, setData] = useState(null);
  const location = useLocation();
  const terminalActive = location.pathname === "/terminal";
  const [terminalVisited, setTerminalVisited] = useState(terminalActive);

  if (typeof window !== 'undefined') {
    window.bootstrap = bootstrap;
  }

  useEffect(() => {
    const handleConnect = () => console.log("Connected to backend");
    const handleUpdate = (visData_local) => {
      console.log("Received new data!");
      setData(visData_local); // store latest snapshot
    };

    socket.on("connect", handleConnect);
    socket.on("update_vis_data", handleUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("update_vis_data", handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (terminalActive) setTerminalVisited(true);
  }, [terminalActive]);
  
  
  return (
    <ToastProvider maxToasts={2}>
    <DataContext.Provider value={{ data, socket }}>
      <div hidden={terminalActive}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/home" element={<Home />} />
          <Route path="/ongoing_task" element={<OngoingTask />} />
          <Route path="/completed_task" element={<CompletedTask />} />
          <Route path="/create_task" element={<CreateTask />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/terminal" element={null} />
          <Route path="*" element={<Navigate to="/404" />} />
          <Route path="/404" element={<NotFound />} />
        </Routes>
      </div>
      {terminalVisited ? (
        <div hidden={!terminalActive}>
          <Suspense fallback={<div className="p-4 text-secondary">Loading terminal...</div>}>
            <TerminalPage active={terminalActive} />
          </Suspense>
        </div>
      ) : null}
      <TaskRecoveryModal />
    </DataContext.Provider>
    </ToastProvider>
  );
}

export default App;
