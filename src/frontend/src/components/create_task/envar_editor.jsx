import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { API_URL } from "../../App";
import TaskIdTemplateHelp from "./task_id_template_help";

const ENV_VAR_PRESETS = [
  { key: "ant_task_id", value: '"[uuid]"', label: "ant_task_id", defaultLabel: "[uuid]" },
  { key: "ant_n_gpus", value: "0", label: "ant_n_gpus", defaultLabel: "0" },
  { key: "ant_wd", value: '"./"', label: "ant_wd", defaultLabel: "./" },
  { key: "ant_conda_env", value: "null", label: "ant_conda_env", defaultLabel: "None" },
  { key: "ant_conda_env_path", value: "null", label: "ant_conda_env_path", defaultLabel: "None" },
  { key: "ant_conda_path", value: '"conda"', label: "ant_conda_path", defaultLabel: "conda" },
  { key: "custom", value: "", label: "custom", defaultLabel: "manual" },
];

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
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const rowsRef = useRef([]);
  const textValueRef = useRef("");
  const modeRef = useRef("table");
  const saveChainRef = useRef(Promise.resolve());

  const updateRowsState = (nextRows) => {
    rowsRef.current = nextRows;
    setRows(nextRows);
  };

  const updateTextValueState = (nextText) => {
    textValueRef.current = nextText;
    setTextValue(nextText);
  };

  const updateModeState = (nextMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/get_envar`);
        if (!res.ok) return;
        const data = await res.json();
        const loaded = objectToRows(data || {});
        updateRowsState(loaded);
        updateTextValueState(JSON.stringify(data || {}, null, 2));
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

  const parseTextObject = (text) => {
    const parsed = JSON.parse(text ? text : "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("JSON must be an object of key: value pairs");
    }
    return parsed;
  };

  const commitSaveRows = async (rs) => {
    const { valid, keyErrors: valKeyErr } = validateRows(rs);
    setKeyErrors(valKeyErr);
    setTextError(null);
    if (!valid) return Promise.reject("Validation failed");

    const payload = rowsToObject(rs);

    const savePromise = saveChainRef.current
      .catch(() => {})
      .then(async () => {
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
          setKeyErrors({});
          updateTextValueState(JSON.stringify(payload, null, 2));
          setTextError(null);
          if (onSave) onSave(payload);
          return payload;
        } catch (err) {
          console.error("Failed to save env:", err);
          throw new Error(String(err.message || err));
        }
      });

    saveChainRef.current = savePromise;
    return savePromise;
  };

  const commitSaveFromText = async (text) => {
    let parsed;
    try {
      parsed = parseTextObject(text);
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

    updateRowsState(newRows);
    updateTextValueState(JSON.stringify(parsed, null, 2));

    return commitSaveRows(newRows);
  };

  useImperativeHandle(ref, () => ({
    saveNow: async () => {
      if (modeRef.current === "textarea") {
        return commitSaveFromText(textValueRef.current);
      } else {
        return commitSaveRows(rowsRef.current);
      }
    },
    getRows: () => rowsRef.current,
    getObject: () => {
      if (modeRef.current === "textarea") {
        return parseTextObject(textValueRef.current);
      }
      return rowsToObject(rowsRef.current);
    },
  }));

  const handleAddPreset = (preset) => {
    const isCustom = preset.key === "custom";
    const next = [
      ...rowsRef.current,
      {
        id: generateId(),
        key: isCustom ? "" : preset.key,
        value: isCustom ? "" : preset.value,
      },
    ];

    setPresetMenuOpen(false);
    updateRowsState(next);
    updateTextValueState(JSON.stringify(rowsToObject(next), null, 2));

    if (!isCustom) {
      commitSaveRows(next).catch((e) => console.error("Save after add preset failed:", e));
    }
  };

  const setPresetMenuOpen = (open) => {
    setIsPresetMenuOpen(open);
  };

  const handleDelete = async (id) => {
    const next = rowsRef.current.filter((r) => r.id !== id);
    updateRowsState(next);
    updateTextValueState(JSON.stringify(rowsToObject(next), null, 2));

    try {
      await commitSaveRows(next);
    } catch (e) {
      console.error("Save after delete failed:", e);
    }
  };

  const handleFieldChange = (id, field, value) => {
    const next = rowsRef.current.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    updateRowsState(next);
    updateTextValueState(JSON.stringify(rowsToObject(next), null, 2));
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
    const updatedRows = rowsRef.current.map((r) => (r.id === id ? { ...r, [field]: newValue } : r));
    updateRowsState(updatedRows);
    updateTextValueState(JSON.stringify(rowsToObject(updatedRows), null, 2));
    commitSaveRows(updatedRows).catch(() => {});
  };

  const handleTextChange = (e) => {
    updateTextValueState(e.target.value);
    setTextError(null);
  };

  const handleTextBlur = () => {
    commitSaveFromText(textValue).catch(() => {});
  };

  const toggleMode = () => {
    setPresetMenuOpen(false);
    if (modeRef.current === "table") {
      updateTextValueState(JSON.stringify(rowsToObject(rowsRef.current), null, 2));
      setTextError(null);
      updateModeState("textarea");
    } else {
      try {
        const parsed = parseTextObject(textValueRef.current);
        const newRows = objectToRows(parsed);
        const { valid, keyErrors: valErr } = validateRows(newRows);
        if (!valid) {
          setKeyErrors(valErr);
          updateRowsState(newRows);
          updateModeState("table");
          return;
        }
        updateRowsState(newRows);
        setKeyErrors({});
        updateModeState("table");
      } catch (e) {
        setTextError(String(e.message || e));
      }
    }
  };

  const existingPresetKeys = new Set(rows.map((row) => (row.key || "").trim()).filter(Boolean));
  const availablePresets = ENV_VAR_PRESETS.filter(
    (preset) => preset.key === "custom" || !existingPresetKeys.has(preset.key)
  );

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

      <div className="mt-3">
        <TaskIdTemplateHelp
          compact={true}
          storageKey="antScheduler.createTask.envTaskIdTemplateHelpExpanded"
        />
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
              <div className="env-var-add-menu">
                <button
                  type="button"
                  className="btn btn-link me-2 dropdown-toggle"
                  onClick={() => setPresetMenuOpen(!isPresetMenuOpen)}
                  disabled={mode !== "table"}
                  aria-expanded={isPresetMenuOpen}
                >
                  + Add Variable
                </button>
                <div className={`dropdown-menu env-var-preset-menu ${isPresetMenuOpen ? "show" : ""}`}>
                  {availablePresets.map((preset) => (
                    <button
                      type="button"
                      key={preset.key}
                      className="dropdown-item env-var-preset-item"
                      onClick={() => handleAddPreset(preset)}
                    >
                      <span className="env-var-preset-key">{preset.label}</span>
                      <span className="env-var-preset-default">{preset.defaultLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
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
