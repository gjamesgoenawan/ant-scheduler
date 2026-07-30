import React, { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import Layout from "../components/layout/layout";
import { readStoredNumber, writeStoredValue } from "../utils/persistedTaskState";

const TERMINAL_FONT_SIZE_STORAGE_KEY = "antScheduler.terminal.fontSize";
const TERMINAL_THEME_STORAGE_KEY = "antScheduler.terminal.theme";

const TERMINAL_THEMES = {
  cockpit: {
    label: "Cockpit",
    swatch: "#1f2937",
    colors: {
      background: "#111827",
      foreground: "#f3f4f6",
      cursor: "#60a5fa",
      cursorAccent: "#111827",
      selectionBackground: "#374151",
      black: "#111827",
      red: "#f87171",
      green: "#34d399",
      yellow: "#fbbf24",
      blue: "#60a5fa",
      magenta: "#c084fc",
      cyan: "#22d3ee",
      white: "#f3f4f6",
      brightBlack: "#6b7280",
      brightRed: "#fca5a5",
      brightGreen: "#6ee7b7",
      brightYellow: "#fcd34d",
      brightBlue: "#93c5fd",
      brightMagenta: "#d8b4fe",
      brightCyan: "#67e8f9",
      brightWhite: "#ffffff",
    },
  },
  graphite: {
    label: "Graphite",
    swatch: "#262626",
    colors: {
      background: "#171717",
      foreground: "#e5e5e5",
      cursor: "#fafafa",
      cursorAccent: "#171717",
      selectionBackground: "#404040",
      black: "#171717",
      red: "#ef4444",
      green: "#84cc16",
      yellow: "#eab308",
      blue: "#38bdf8",
      magenta: "#e879f9",
      cyan: "#2dd4bf",
      white: "#e5e5e5",
      brightBlack: "#737373",
      brightRed: "#f87171",
      brightGreen: "#a3e635",
      brightYellow: "#facc15",
      brightBlue: "#7dd3fc",
      brightMagenta: "#f0abfc",
      brightCyan: "#5eead4",
      brightWhite: "#ffffff",
    },
  },
  light: {
    label: "Paper",
    swatch: "#f8fafc",
    colors: {
      background: "#f8fafc",
      foreground: "#1e293b",
      cursor: "#2563eb",
      cursorAccent: "#f8fafc",
      selectionBackground: "#bfdbfe",
      black: "#0f172a",
      red: "#dc2626",
      green: "#15803d",
      yellow: "#a16207",
      blue: "#2563eb",
      magenta: "#a21caf",
      cyan: "#0e7490",
      white: "#e2e8f0",
      brightBlack: "#64748b",
      brightRed: "#ef4444",
      brightGreen: "#16a34a",
      brightYellow: "#ca8a04",
      brightBlue: "#3b82f6",
      brightMagenta: "#c026d3",
      brightCyan: "#0891b2",
      brightWhite: "#ffffff",
    },
  },
  solarized: {
    label: "Solarized",
    swatch: "#002b36",
    colors: {
      background: "#002b36",
      foreground: "#93a1a1",
      cursor: "#b58900",
      cursorAccent: "#002b36",
      selectionBackground: "#073642",
      black: "#073642",
      red: "#dc322f",
      green: "#859900",
      yellow: "#b58900",
      blue: "#268bd2",
      magenta: "#d33682",
      cyan: "#2aa198",
      white: "#eee8d5",
      brightBlack: "#586e75",
      brightRed: "#cb4b16",
      brightGreen: "#586e75",
      brightYellow: "#657b83",
      brightBlue: "#839496",
      brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1",
      brightWhite: "#fdf6e3",
    },
  },
};

function readStoredTheme() {
  if (typeof window === "undefined") return "cockpit";
  try {
    const value = JSON.parse(window.localStorage.getItem(TERMINAL_THEME_STORAGE_KEY) || '"cockpit"');
    return TERMINAL_THEMES[value] ? value : "cockpit";
  } catch {
    return "cockpit";
  }
}

function terminalWebSocketUrl() {
  const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${socketProtocol}//${window.location.host}/terminal/ws`;
}

export default function TerminalPage({ active }) {
  const terminalHostRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const lastSentSizeRef = useRef(null);
  const [fontSize, setFontSize] = useState(() =>
    Math.max(6, Math.min(readStoredNumber(TERMINAL_FONT_SIZE_STORAGE_KEY, 14), 24))
  );
  const [themeName, setThemeName] = useState(() => readStoredTheme());
  const [connectionState, setConnectionState] = useState("connecting");
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    const host = terminalHostRef.current;
    if (!host) return undefined;

    setConnectionState("connecting");
    const terminal = new XTerm({
      cursorBlink: false,
      cursorStyle: "block",
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize,
      lineHeight: 1.18,
      macOptionClickForcesSelection: true,
      scrollback: 10000,
      theme: TERMINAL_THEMES[themeName].colors,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const socket = new WebSocket(terminalWebSocketUrl());
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;
    const heartbeatTimer = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "heartbeat" }));
      }
    }, 20000);

    const sendResize = () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const currentSize = `${terminal.rows}:${terminal.cols}`;
      if (lastSentSizeRef.current === currentSize) return;
      lastSentSizeRef.current = currentSize;
      socket.send(JSON.stringify({ type: "resize", rows: terminal.rows, cols: terminal.cols }));
    };

    const fitTerminal = () => {
      const hostBounds = host.getBoundingClientRect();
      if (hostBounds.width <= 0 || hostBounds.height <= 0 || host.getClientRects().length === 0) {
        return;
      }
      try {
        fitAddon.fit();
        sendResize();
      } catch {
        // The terminal can be between mount and layout during route transitions.
      }
    };

    socket.addEventListener("open", () => {
      setConnectionState("connected");
      fitTerminal();
      terminal.focus();
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        terminal.write(event.data);
      } else {
        terminal.write(new Uint8Array(event.data));
      }
    });
    socket.addEventListener("close", () => {
      setConnectionState("disconnected");
      terminal.write("\r\n\x1b[33mTerminal session disconnected. Start a new session to reconnect.\x1b[0m\r\n");
    });
    socket.addEventListener("error", () => setConnectionState("error"));

    const inputDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });
    const forceAltSelection = (event) => {
      if (!event.altKey || event.shiftKey || event.button !== 0) return;
      if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      event.target.dispatchEvent(new MouseEvent(event.type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: event.detail,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        shiftKey: true,
        metaKey: event.metaKey,
        button: event.button,
        buttons: event.buttons,
      }));
    };
    host.addEventListener("mousedown", forceAltSelection, true);
    const resizeObserver = new ResizeObserver(fitTerminal);
    resizeObserver.observe(host);
    window.addEventListener("resize", fitTerminal);

    return () => {
      window.clearInterval(heartbeatTimer);
      host.removeEventListener("mousedown", forceAltSelection, true);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitTerminal);
      inputDisposable.dispose();
      socket.close();
      terminal.dispose();
      socketRef.current = null;
      xtermRef.current = null;
      fitAddonRef.current = null;
      lastSentSizeRef.current = null;
    };
  }, [sessionKey]);

  useEffect(() => {
    writeStoredValue(TERMINAL_FONT_SIZE_STORAGE_KEY, fontSize);
    const terminal = xtermRef.current;
    if (!terminal) return;
    terminal.options.fontSize = fontSize;
    fitAddonRef.current?.fit();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const currentSize = `${terminal.rows}:${terminal.cols}`;
      if (lastSentSizeRef.current !== currentSize) {
        lastSentSizeRef.current = currentSize;
        socketRef.current.send(
          JSON.stringify({ type: "resize", rows: terminal.rows, cols: terminal.cols })
        );
      }
    }
  }, [fontSize]);

  useEffect(() => {
    writeStoredValue(TERMINAL_THEME_STORAGE_KEY, themeName);
    if (xtermRef.current) {
      xtermRef.current.options.theme = TERMINAL_THEMES[themeName].colors;
    }
  }, [themeName]);

  useEffect(() => {
    if (!active) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const terminal = xtermRef.current;
      fitAddonRef.current?.fit();
      if (terminal && socketRef.current?.readyState === WebSocket.OPEN) {
        const currentSize = `${terminal.rows}:${terminal.cols}`;
        if (lastSentSizeRef.current !== currentSize) {
          lastSentSizeRef.current = currentSize;
          socketRef.current.send(
            JSON.stringify({ type: "resize", rows: terminal.rows, cols: terminal.cols })
          );
        }
      }
      terminal?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  const statusLabel = {
    connecting: "Connecting",
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Connection Error",
  }[connectionState];

  return (
    <Layout pageTitle="Terminal" compactHeader>
      <div className="container-fluid terminal-page">
        <section className="terminal-workspace">
          <header className="terminal-toolbar">
            <div className="terminal-toolbar-status">
              <span className={`terminal-status-dot terminal-status-${connectionState}`} />
              <span>{statusLabel}</span>
            </div>

            <div className="terminal-toolbar-controls">
              <label className="terminal-font-control">
                <span>Font</span>
                <input
                  type="range"
                  min="6"
                  max="24"
                  step="1"
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                  aria-label="Terminal font size"
                />
                <output>{fontSize}px</output>
              </label>

              <div className="terminal-theme-control" aria-label="Terminal theme">
                {Object.entries(TERMINAL_THEMES).map(([key, theme]) => (
                  <button
                    key={key}
                    type="button"
                    className={`terminal-theme-button ${themeName === key ? "terminal-theme-button-active" : ""}`}
                    onClick={() => setThemeName(key)}
                    title={`${theme.label} theme`}
                    aria-label={`${theme.label} theme`}
                    aria-pressed={themeName === key}
                  >
                    <span
                      className="terminal-theme-swatch"
                      style={{ backgroundColor: theme.swatch }}
                    />
                    <span>{theme.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-outline-dark terminal-new-session-btn mb-0"
                onClick={() => setSessionKey((current) => current + 1)}
                title="Close the current shell and start a new terminal session"
              >
                <i className="material-icons">restart_alt</i>
                <span>New Session</span>
              </button>
            </div>
          </header>

          <div className="terminal-stage" style={{ backgroundColor: TERMINAL_THEMES[themeName].colors.background }}>
            <div
              ref={terminalHostRef}
              className="terminal-host"
              style={{ backgroundColor: TERMINAL_THEMES[themeName].colors.background }}
            />
          </div>
        </section>
      </div>
    </Layout>
  );
}