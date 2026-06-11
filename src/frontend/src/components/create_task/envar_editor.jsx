import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { API_URL } from "../../App";
import TaskIdTemplateHelp from "./task_id_template_help";
import { useToast } from "../layout/layout";
import {
  readStoredBoolean,
  writeStoredValue,
} from "../../utils/persistedTaskState";

const ENV_VAR_PRESETS = [
  { key: "ant_task_id", value: '"[uuid]"', label: "ant_task_id", defaultLabel: "[uuid]" },
  { key: "ant_n_gpus", value: "0", label: "ant_n_gpus", defaultLabel: "0" },
  { key: "ant_wd", value: '"./"', label: "ant_wd", defaultLabel: "./" },
  { key: "ant_conda_env", value: "null", label: "ant_conda_env", defaultLabel: "None" },
  { key: "ant_conda_env_path", value: "null", label: "ant_conda_env_path", defaultLabel: "None" },
  { key: "ant_conda_path", value: '"conda"', label: "ant_conda_path", defaultLabel: "conda" },
  { key: "custom", value: "", label: "custom", defaultLabel: "manual" },
];

const ENV_SLOT_PANEL_STORAGE_KEY = "antScheduler.createTask.envSlotsExpanded";

function defaultSlotName(index) {
  return `Slot ${index + 1}`;
}

function normalizeEnvSlotState(payload) {
  const source = payload?.data && Array.isArray(payload.data.slots) ? payload.data : payload;
  const rawSlots = Array.isArray(source?.slots) ? source.slots : [];
  const rawCount = Number.isFinite(source?.slot_count) ? source.slot_count : rawSlots.length;
  const slotCount = Math.max(0, rawCount || 0);

  return {
    slot_count: slotCount,
    slots: Array.from({ length: slotCount }, (_, index) => {
      const rawSlot = rawSlots[index];
      const envar =
        rawSlot && typeof rawSlot.envar === "object" && rawSlot.envar !== null && !Array.isArray(rawSlot.envar)
          ? rawSlot.envar
          : {};
      const name = typeof rawSlot?.name === "string" && rawSlot.name.trim()
        ? rawSlot.name.trim()
        : defaultSlotName(index);

      return {
        index,
        name,
        envar,
        saved_at: rawSlot?.saved_at ?? null,
        is_empty: typeof rawSlot?.is_empty === "boolean" ? rawSlot.is_empty : Object.keys(envar).length === 0,
      };
    }),
  };
}

function hasEnvValues(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function formatSlotSavedAt(savedAt) {
  if (!savedAt) return "";

  try {
    return new Date(savedAt * 1000).toLocaleString();
  } catch {
    return "";
  }
}

function summarizeSlotEnvar(envar) {
  const keys = Object.keys(envar || {});
  if (keys.length === 0) return "No variables saved";
  const preview = keys.slice(0, 3).join(", ");
  return keys.length > 3 ? `${preview} +${keys.length - 3} more` : preview;
}

function generateId() {
  return (
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("") + Date.now().toString(36)
  );
}

const EnvVarEditor = forwardRef(function EnvVarEditor({ onSave, onLoad }, ref) {
  const { addToast } = useToast();
  const [rows, setRows] = useState([]); // [{id, key, value (string)}, ...]
  const [keyErrors, setKeyErrors] = useState({}); 
  const [mode, setMode] = useState("table"); // "table" or "textarea"
  const [textValue, setTextValue] = useState(""); 
  const [textError, setTextError] = useState(null); 
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [slotState, setSlotState] = useState({ slot_count: 0, slots: [] });
  const [slotNameDrafts, setSlotNameDrafts] = useState({});
  const [isSlotStateLoading, setIsSlotStateLoading] = useState(true);
  const [slotStateError, setSlotStateError] = useState(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);
  const [isSlotPanelExpanded, setIsSlotPanelExpanded] = useState(() =>
    readStoredBoolean(ENV_SLOT_PANEL_STORAGE_KEY, true)
  );
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

  const applySlotState = (payload) => {
    const normalized = normalizeEnvSlotState(payload);
    setSlotState(normalized);
    setSlotNameDrafts(
      Object.fromEntries(normalized.slots.map((slot) => [slot.index, slot.name]))
    );
    return normalized;
  };

  const replaceEditorObject = (nextObject) => {
    const normalizedObject =
      nextObject && typeof nextObject === "object" && !Array.isArray(nextObject) ? nextObject : {};
    const nextRows = objectToRows(normalizedObject);
    updateRowsState(nextRows);
    updateTextValueState(JSON.stringify(normalizedObject, null, 2));
    setKeyErrors({});
    setTextError(null);
    return nextRows;
  };

  const requestSlotState = async (path, body = null) => {
    const response = await fetch(`${API_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || `Request failed with status ${response.status}`);
    }

    return applySlotState(payload);
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

  useEffect(() => {
    (async () => {
      try {
        setIsSlotStateLoading(true);
        setSlotStateError(null);
        await requestSlotState("/get_envar_slots");
      } catch (error) {
        console.error("Failed to load env slots:", error);
        setSlotStateError(String(error.message || error));
      } finally {
        setIsSlotStateLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    writeStoredValue(ENV_SLOT_PANEL_STORAGE_KEY, isSlotPanelExpanded);
  }, [isSlotPanelExpanded]);

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
    hasContent: () => {
      if (modeRef.current === "textarea") {
        const trimmed = textValueRef.current.trim();
        return trimmed !== "" && trimmed !== "{}";
      }

      return hasEnvValues(rowsToObject(rowsRef.current));
    },
    replaceAll: async (nextObject) => {
      const nextRows = replaceEditorObject(nextObject);
      return commitSaveRows(nextRows);
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
    commitSaveFromText(textValueRef.current).catch(() => {});
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

  const handleSlotNameChange = (index, value) => {
    setSlotNameDrafts((current) => ({ ...current, [index]: value }));
  };

  const handleSaveSlot = async (slotIndex) => {
    setActiveSlotIndex(slotIndex);
    try {
      const latestEnvar = await (modeRef.current === "textarea"
        ? commitSaveFromText(textValueRef.current)
        : commitSaveRows(rowsRef.current));

      if (!hasEnvValues(latestEnvar)) {
        throw new Error("No environment variables to save into a slot.");
      }

      const draftName = slotNameDrafts[slotIndex];
      const nextState = await requestSlotState("/save_envar_slot", {
        slot_index: slotIndex,
        name: draftName,
        envar: latestEnvar,
      });

      const savedSlot = nextState.slots[slotIndex];
      addToast({
        type: "success",
        title: `Saved ${savedSlot.name}`,
        autohide: true,
        delay: 2000,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to save slot",
        message: String(error.message || error),
        autohide: true,
        delay: 3200,
      });
    } finally {
      setActiveSlotIndex(null);
    }
  };

  const handleLoadSlot = async (slot) => {
    if (slot.is_empty) {
      await handleSaveSlot(slot.index);
      return;
    }

    let shouldWarn = false;
    if (ref?.current?.hasContent) {
      shouldWarn = ref.current.hasContent();
    } else if (modeRef.current === "textarea") {
      const trimmed = textValueRef.current.trim();
      shouldWarn = trimmed !== "" && trimmed !== "{}";
    } else {
      shouldWarn = hasEnvValues(rowsToObject(rowsRef.current));
    }

    if (shouldWarn) {
      const shouldOverwrite = window.confirm(
        `Current Environment Variables already contain values. Overwrite them with \"${slot.name}\"?`
      );
      if (!shouldOverwrite) return;
    }

    setActiveSlotIndex(slot.index);
    try {
      await ref.current.replaceAll(slot.envar);
      addToast({
        type: "success",
        title: `Loaded ${slot.name}`,
        autohide: true,
        delay: 2000,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to load slot",
        message: String(error.message || error),
        autohide: true,
        delay: 3200,
      });
    } finally {
      setActiveSlotIndex(null);
    }
  };

  const handleRenameSlot = async (slot) => {
    setActiveSlotIndex(slot.index);
    try {
      const nextState = await requestSlotState("/rename_envar_slot", {
        slot_index: slot.index,
        name: slotNameDrafts[slot.index],
      });
      const renamedSlot = nextState.slots[slot.index];
      addToast({
        type: "success",
        title: `Renamed to ${renamedSlot.name}`,
        autohide: true,
        delay: 1800,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to rename slot",
        message: String(error.message || error),
        autohide: true,
        delay: 3200,
      });
    } finally {
      setActiveSlotIndex(null);
    }
  };

  const handleClearSlot = async (slot) => {
    const shouldClear = window.confirm(`Clear saved variables in \"${slot.name}\"?`);
    if (!shouldClear) return;

    setActiveSlotIndex(slot.index);
    try {
      await requestSlotState("/clear_envar_slot", {
        slot_index: slot.index,
      });
      addToast({
        type: "success",
        title: `Cleared ${slot.name}`,
        autohide: true,
        delay: 1800,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to clear slot",
        message: String(error.message || error),
        autohide: true,
        delay: 3200,
      });
    } finally {
      setActiveSlotIndex(null);
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

      <div className="mt-3">
        <TaskIdTemplateHelp
          compact={true}
          storageKey="antScheduler.createTask.envTaskIdTemplateHelpExpanded"
        />
      </div>

      <div
        className={`task-id-template-help task-id-template-help-compact env-slot-panel ${
          isSlotPanelExpanded ? "" : "task-id-template-help-collapsed"
        }`}
      >
        <button
          type="button"
          className="task-id-template-help-header"
          onClick={() => setIsSlotPanelExpanded((current) => !current)}
          aria-expanded={isSlotPanelExpanded}
        >
          <span className="task-id-template-help-title">Environment Variable Slots</span>
          <span className="task-id-template-help-toggle">
            <i className="material-icons text-sm">{isSlotPanelExpanded ? "expand_less" : "expand_more"}</i>
          </span>
        </button>

        {isSlotPanelExpanded ? (
          <div className="task-id-template-help-body">
            <p className="task-id-template-help-copy mb-0">
              Click an empty slot to save the current workspace variables. Click a saved slot to load it into the workspace.
            </p>

            {isSlotStateLoading ? (
              <div className="env-slot-empty-state">Loading saved slots...</div>
            ) : slotStateError ? (
              <div className="env-slot-empty-state text-danger">{slotStateError}</div>
            ) : (
              <div className="env-slot-grid">
                {slotState.slots.map((slot) => {
                  const slotBusy = activeSlotIndex === slot.index;
                  const slotSavedAt = formatSlotSavedAt(slot.saved_at);

                  return (
                    <div
                      key={slot.index}
                      role="button"
                      tabIndex={0}
                      className={`env-slot-card ${slot.is_empty ? "env-slot-card-empty" : "env-slot-card-filled"} ${
                        slotBusy ? "env-slot-card-busy" : ""
                      }`}
                      onClick={() => handleLoadSlot(slot)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleLoadSlot(slot);
                        }
                      }}
                    >
                      <div className="env-slot-card-top">
                        <span className="env-slot-badge">#{slot.index + 1}</span>
                        {slot.is_empty ? (
                          <span className="env-slot-status">Empty</span>
                        ) : (
                          <span className="env-slot-status">Saved</span>
                        )}
                      </div>

                      {slot.is_empty ? (
                        <div className="env-slot-empty-copy">
                          <i className="material-icons">add_circle_outline</i>
                          <span>Save current variables</span>
                        </div>
                      ) : (
                        <>
                          <div className="env-slot-name-row" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="text"
                              className="form-control env-slot-name-input"
                              value={slotNameDrafts[slot.index] ?? slot.name}
                              onChange={(event) => handleSlotNameChange(slot.index, event.target.value)}
                              onBlur={() => handleRenameSlot(slot)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleRenameSlot(slot);
                                }
                              }}
                              disabled={slotBusy}
                            />
                          </div>

                          <div className="env-slot-summary">{summarizeSlotEnvar(slot.envar)}</div>
                          <div className="env-slot-meta">
                            {Object.keys(slot.envar || {}).length} variable(s)
                            {slotSavedAt ? ` | Saved ${slotSavedAt}` : ""}
                          </div>

                          <div className="env-slot-actions" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              className="btn btn-link env-slot-action-btn"
                              onClick={() => handleRenameSlot(slot)}
                              disabled={slotBusy}
                              title="Save Slot Name"
                            >
                              <i className="material-icons text-sm">save</i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-link env-slot-action-btn text-danger"
                              onClick={() => handleClearSlot(slot)}
                              disabled={slotBusy}
                              title="Clear Slot"
                            >
                              <i className="material-icons text-sm">delete_outline</i>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
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
