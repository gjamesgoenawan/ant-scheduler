import { lazy, memo, Suspense, useEffect, useRef, useState, createContext, useContext } from "react";
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
import { fetchWithTimeout } from "./utils/fetchWithTimeout";

const TerminalPage = lazy(() => import("./pages/terminal"));

const DataContext = createContext(null);

const PERSISTENT_PAGES = {
  "/home": Home,
  "/ongoing_task": OngoingTask,
  "/completed_task": CompletedTask,
  "/create_task": CreateTask,
  "/logs": Logs,
};

const PersistentPage = memo(function PersistentPage({ active, component: Component, liveData }) {
  const frozenDataRef = useRef(liveData);
  if (active) frozenDataRef.current = liveData;

  return (
    <div hidden={!active}>
      <DataContext.Provider value={{ data: active ? liveData : frozenDataRef.current, socket }}>
        <Component />
      </DataContext.Provider>
    </div>
  );
}, (previous, next) => (
  !previous.active && !next.active && previous.component === next.component
));

export function useMonitorData() {
  return useContext(DataContext);
}
export const API_URL = `/api`;
export const SOCKETIO_URL = '/';

function appendHistory(previous = [], incoming = [], limit = 300) {
  return [...previous, ...incoming].slice(-Math.max(1, limit));
}

function mergeMonitor(previous, incoming) {
  if (!incoming?._incremental) return incoming;

  const historySize = incoming._history_size || previous?.cpu_usage?.length || 300;
  const merged = { ...previous, ...incoming };
  delete merged._incremental;
  delete merged._history_size;

  for (const key of ["cpu_usage", "ram_usage"]) {
    merged[key] = appendHistory(previous?.[key], incoming[key], historySize);
  }
  for (const key of ["gpu_usage", "gpu_memory", "gpu_power_draw"]) {
    const previousSeries = previous?.[key] || [];
    const incomingSeries = incoming[key] || [];
    merged[key] = incomingSeries.map((values, index) =>
      appendHistory(previousSeries[index], values, historySize)
    );
  }
  return merged;
}

function mergeVisData(previous, incoming) {
  if (!previous) return incoming;
  return {
    ...previous,
    ...incoming,
    monitor: incoming.monitor ? mergeMonitor(previous.monitor, incoming.monitor) : previous.monitor,
  };
}

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
  autoConnect: false,
});

function App() {
  const [data, setData] = useState(null);
  const completedLoadRef = useRef(null);
  const location = useLocation();
  const terminalActive = location.pathname === "/terminal";
  const activePage = PERSISTENT_PAGES[location.pathname] ? location.pathname : null;
  const [visitedPages, setVisitedPages] = useState(() => new Set(activePage ? [activePage] : []));
  const [terminalVisited, setTerminalVisited] = useState(terminalActive);

  if (typeof window !== 'undefined') {
    window.bootstrap = bootstrap;
  }

  useEffect(() => {
    const handleConnect = () => console.log("Connected to backend");
    const handleUpdate = (visData_local) => {
      setData((current) => mergeVisData(current, visData_local));
    };

    socket.on("connect", handleConnect);
    socket.on("update_vis_data", handleUpdate);
    socket.connect();

    fetchWithTimeout(`${API_URL}/vis?include_completed=false`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Initial data returned ${response.status}`)))
      .then((payload) => handleUpdate(payload?.data || payload))
      .catch((error) => console.warn("Initial scheduler data request failed", error));

    return () => {
      socket.off("connect", handleConnect);
      socket.off("update_vis_data", handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!["/completed_task", "/logs"].includes(activePage) || data?.task_completed || completedLoadRef.current) {
      return;
    }

    completedLoadRef.current = fetchWithTimeout(`${API_URL}/completed_tasks`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Completed tasks returned ${response.status}`)))
      .then((payload) => setData((current) => mergeVisData(current, { task_completed: payload?.data || [] })))
      .catch((error) => console.warn("Completed task history request failed", error))
      .finally(() => {
        completedLoadRef.current = null;
      });
  }, [activePage, data?.task_completed]);

  useEffect(() => {
    if (!activePage) return;
    setVisitedPages((current) => {
      if (current.has(activePage)) return current;
      return new Set([...current, activePage]);
    });
  }, [activePage]);

  useEffect(() => {
    if (terminalActive) setTerminalVisited(true);
  }, [terminalActive]);
  
  
  return (
    <ToastProvider maxToasts={2}>
    <DataContext.Provider value={{ data, socket }}>
      {[...visitedPages].map((path) => (
        <PersistentPage
          key={path}
          active={activePage === path}
          component={PERSISTENT_PAGES[path]}
          liveData={data}
        />
      ))}
      <Routes>
        <Route path="/" element={<Navigate to="/home" />} />
        {Object.keys(PERSISTENT_PAGES).map((path) => <Route key={path} path={path} element={null} />)}
        <Route path="/terminal" element={null} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" />} />
      </Routes>
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
