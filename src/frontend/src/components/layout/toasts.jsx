import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children, maxToasts = 2 }) {
  const [toasts, setToasts] = useState([]); // { id, type, title, message, autohide, delay }
  const mountedRef = useRef(false);

  useEffect(() => {
    // ignore first render
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    toasts.forEach((t) => {
      const el = document.getElementById(t.id);
      if (!el) return;
      // if already shown, skip
      if (el.dataset?.shown) return;

      const inst = window.bootstrap?.Toast.getOrCreateInstance(el, {
        autohide: t.autohide,
        delay: t.delay,
      });

      inst?.show();
      el.dataset.shown = "1";

      const onHidden = () => {
        // remove from state once hidden
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
        el.removeEventListener("hidden.bs.toast", onHidden);
      };

      el.addEventListener("hidden.bs.toast", onHidden, { once: true });
    });
  }, [toasts]);

  const addToast = ({ type = "info", title = "", message = "", autohide = true, delay = 1000000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => {
      // append
      let next = [...prev, { id, type, title, message, autohide, delay }];

      if (next.length > maxToasts) {
        const overflow = next.length - maxToasts;
        const toDrop = next.slice(0, overflow);
        toDrop.forEach((t) => {
          try {
            const el = document.getElementById(t.id);
            if (el) {
              const inst = window.bootstrap?.Toast.getOrCreateInstance(el);
              inst?.hide();
            }
          } catch (e) {
            // ignore errors
          }
        });
        next = next.slice(-maxToasts);
      }
      return next;
    });
    return id;
  };

  const removeToast = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const inst = window.bootstrap?.Toast.getOrCreateInstance(el);
      inst?.hide();
    } else {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      <div className="position-fixed top-2 end-1 z-index-2" style={{ zIndex: 2000 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            id={t.id}
            className={`toast fade p-2 mb-3 ${t.type === "error" ? "bg-danger text-white" : "bg-white"}`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className={`toast-header border-0 ${t.type === "error" ? "bg-transparent text-white" : ""}`}>
              <i
                className={`material-icons me-2 ${
                  t.type === "error"
                    ? "text-white"
                    : t.type === "success"
                    ? "text-success"
                    : "text-warning"
                }`}
              >
                {t.type === "error"
                  ? "error"
                  : t.type === "success"
                  ? "check"
                  : "priority_high"}
              </i>
              <strong className="me-auto">{t.title || (t.type === "error" ? "Error" : "Success")}</strong>
            </div>
            {t.message !== "" && (
              <div className={`toast-body ${t.type === "error" ? "text-white" : ""}`}>
                {t.message}
              </div>
            )}
          </div>
        ))}
      </div>

    </ToastContext.Provider>
  );
}
