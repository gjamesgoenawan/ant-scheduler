import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { API_URL } from "../../App";

function generateId() {
  return (
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("") + Date.now().toString(36)
  );
}

const EnvVarEditor = forwardRef(function EnvVarEditor({ onSave, onLoad }, ref) {
  const [rows, setRows] = useState([]); // [{id, key, value (string)}, ...]
  const [keyErrors, setKeyErrors] = useState({}); 
  const [mode, setMode] = useState("table"); // "table" or "textarea"
  const [textValue, setTextValue] = useState(""); 
  const [textError, setTextError] = useState(null); 
  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/get_envar`);
        if (!res.ok) return;
        const data = await res.json();
        const loaded = objectToRows(data || {});
        setRows(loaded);
        setTextValue(JSON.stringify(data || {}, null, 2));
        if (onLoad) onLoad(data || {});
      } catch (e) {
        console.error("Failed to load env:", e);
      }
    })();
  }, []);

  const parseLiteral = (s) => {
    if (s === "") return "";

    // check if surrounded by quotes (either ".." or '..')
    const isQuoted =
      s.length >= 2 &&
      ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"));

    if (isQuoted) {
      if (s[0] === '"') {
        try {
          return JSON.parse(s);
        } catch (e) {
          return s.slice(1, -1);
        }
      }
      return s.slice(1, -1);
    }

    try {
      return JSON.parse(s);
    } catch (e) {
      return s;
    }
  };

  const rowsToObject = (rs) => {
    const payload = {};
    rs.forEach((r) => {
      const kk = (r.key || "").trim();
      if (!kk) return;
      payload[kk] = parseLiteral(r.value ?? "");
    });
    return payload;
  };

  const objectToRows = (obj) =>
    Object.keys(obj || {}).map((k) => {
      const v = obj[k];
      if (v === null) return { id: generateId(), key: String(k), value: "null" };
      if (typeof v === "string") return { id: generateId(), key: String(k), value: `"${v}"` };
      if (typeof v === "number" || typeof v === "boolean")
        return { id: generateId(), key: String(k), value: String(v) };
      // object/array -> show JSON string
      return { id: generateId(), key: String(k), value: JSON.stringify(v) };
    });

  const validateRows = (rs) => {
    const idErr = {};
    const names = rs.map((r) => (r.key || "").trim());
    rs.forEach((r) => {
      if (!r.key || !r.key.trim()) {
        idErr[r.id] = "Key cannot be empty";
      }
    });
    const counts = {};
    names.forEach((n) => {
      if (!n) return;
      counts[n] = (counts[n] || 0) + 1;
    });
    rs.forEach((r) => {
      const n = (r.key || "").trim();
      if (n && counts[n] > 1) {
        idErr[r.id] = "Duplicate key";
      }
    });
    return { valid: Object.keys(idErr).length === 0, keyErrors: idErr };
  };

  const commitSaveRows = async (rs) => {
    if (savingRef.current) return Promise.reject("Environment variable saving in progress");

    const { valid, keyErrors: valKeyErr } = validateRows(rs);
    setKeyErrors(valKeyErr);
    setTextError(null);
    if (!valid) return Promise.reject("Validation failed");

    const payload = rowsToObject(rs);

    savingRef.current = true;
    try {
      const r = await fetch(`${API_URL}/save_envar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envar: payload }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "Save failed");
        throw new Error(text || "Save failed");
      }
      setRows(rs);
      setKeyErrors({});
      setTextValue(JSON.stringify(payload, null, 2));
      setTextError(null);
      if (onSave) onSave(payload);
      return payload;
    } catch (err) {
      console.error("Failed to save env:", err);
      return Promise.reject(String(err.message || err));
    } finally {
      setTimeout(() => (savingRef.current = false), 200);
    }
  };

  const commitSaveFromText = async (text) => {
    let parsed;
    try {
      parsed = JSON.parse(text ? text : "{}");
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("JSON must be an object of key: value pairs");
      }
    } catch (e) {
      setTextError(String(e.message || e));
      return Promise.reject(String(e.message || e));
    }

    const newRows = objectToRows(parsed);

    const { valid, keyErrors: keyErr } = validateRows(newRows);
    if (!valid) {
      setKeyErrors(keyErr);
      setTextError("Validation failed: duplicate or empty keys");
      return Promise.reject("Validation failed");
    }

    return commitSaveRows(newRows);
  };

  useImperativeHandle(ref, () => ({
    saveNow: async () => {
      if (mode === "textarea") {
        return commitSaveFromText(textValue);
      } else {
        return commitSaveRows(rows);
      }
    },
    getRows: () => rows,
    getObject: () => rowsToObject(rows),
  }));

  const handleAddRow = () => {
    const id = generateId();
    setRows((prev) => {
      const next = [...prev, { id, key: "", value: "" }];
      setTextValue(JSON.stringify(rowsToObject(next), null, 2));
      return next;
    });
  };

  const handleDelete = async (id) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      setTextValue(JSON.stringify(rowsToObject(next), null, 2));
      return next;
    });

    try {
      await commitSaveRows(rows.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Save after delete failed:", e);
    }
  };

  const handleFieldChange = (id, field, value) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
      setTextValue(JSON.stringify(rowsToObject(next), null, 2));
      return next;
    });
    if (field === "key") {
      setKeyErrors((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleBlur = (id, field, newValue) => {
    setRows((prev) => {
      const updatedRows = prev.map((r) => (r.id === id ? { ...r, [field]: newValue } : r));
      setTextValue(JSON.stringify(rowsToObject(updatedRows), null, 2));
      commitSaveRows(updatedRows).catch(() => {});
      return updatedRows;
    });
  };

  const handleTextChange = (e) => {
    setTextValue(e.target.value);
    setTextError(null);
  };

  const handleTextBlur = () => {
    commitSaveFromText(textValue).catch(() => {});
  };

  const toggleMode = () => {
    if (mode === "table") {
      setTextValue(JSON.stringify(rowsToObject(rows), null, 2));
      setTextError(null);
      setMode("textarea");
    } else {
      try {
        const parsed = JSON.parse(textValue);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setTextError("JSON must be an object of key: value pairs");
          return;
        }
        const newRows = objectToRows(parsed);
        const { valid, keyErrors: valErr } = validateRows(newRows);
        if (!valid) {
          setKeyErrors(valErr);
          setRows(newRows);
          setMode("table");
          return;
        }
        setRows(newRows);
        setKeyErrors({});
        setMode("table");
      } catch (e) {
        setTextError(String(e.message || e));
      }
    }
  };

  return (
    <div className="">
      <div className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0 mt-4">Environment Variables</h5>

        <div className="d-flex">
          <div className="form-check form-switch me-3 d-flex justify-content-center align-items-center mt-4 px-3">
            <div className="d-flex"
             style={{ fontSize:'0.9rem' }}>Table Mode</div>
            <input
              className="form-check-input"
              style={{ marginTop: 10, marginLeft: 10, marginBottom: 10 }}
              type="checkbox"
              id="modeSwitch"
              checked={mode === "table"}
              onChange={toggleMode}
            />
          </div>
        </div>
      </div>

      <div className="">
        {mode === "table" ? (
          <div>
            <table className="table mb-0">
              <thead>
                <tr style={{ fontSize: '0.9rem', fontFamily: "'Courier New', monospace" }}>
                  <th style={{ width: "35%", fontWeight: '600', color:'var(--bs-card-color)' }}>Key</th>
                  <th style={{ fontWeight: '600', color:'var(--bs-card-color)' }}>Value</th>
                  <th style={{ width: "80px" }}></th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted p-4">
                      No environment variable
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const kErr = keyErrors[row.id];
                    return (
                      <tr key={row.id}
                        style={{ verticalAlign: 'middle' }}>
                        <td>
                          <input
                            className={`form-control ${kErr ? "is-invalid" : ""} px-3`}
                            value={row.key}
                            onChange={(e) => handleFieldChange(row.id, "key", e.target.value)}
                            onBlur={(e) => handleBlur(row.id, "key", e.target.value)}
                            placeholder="VAR_NAME"
                            style={{ fontFamily: "'Courier New', monospace" }}
                          />
                          {kErr ? (
                            <div className="invalid-feedback" style={{ display: "block" }}>
                              {kErr}
                            </div>
                          ) : null}
                        </td>

                        <td>
                          <input
                            className="form-control px-3"
                            value={row.value}
                            onChange={(e) => handleFieldChange(row.id, "value", e.target.value)}
                            onBlur={(e) => handleBlur(row.id, "value", e.target.value)}
                            placeholder='value (e.g. 3, true, "a string", {"k":1})'
                            style={{ fontFamily: "'Courier New', monospace" }}
                          />
                        </td>

                        <td className="text-center align-middle">
                          <button type="button" className="btn btn-link mb-0" onClick={() => handleDelete(row.id)}>
                            <i className="material-icons text-m me-2" style={{ color: "red" }}>
                              clear
                            </i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div className="d-flex justify-content-center align-items-center">
              <button type="button" className="btn btn-link me-2" onClick={handleAddRow} disabled={mode !== "table"}>
                + Add Variable
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="input-group input-group-outline my-3 is-filled">
              <textarea
                className={`form-control ${textError ? "is-invalid" : ""}`}
                rows={5}
                value={textValue}
                onChange={handleTextChange}
                onBlur={handleTextBlur}
                style={{ fontFamily: "'Courier New', monospace", whiteSpace: "pre" }}
              />
            </div>
            {textError ? (
              <div className="text-danger small mt-2" role="alert">
                {textError}
              </div>
            ) : (
              ""
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default EnvVarEditor;
