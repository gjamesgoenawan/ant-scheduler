import React from "react";

import { clampLineCount } from "../utils/lineCount";

export default function LineCountControl({
  label,
  value,
  min = 1,
  max = 500,
  disabled = false,
  onChange,
}) {
  const handleValueChange = (nextValue) => {
    if (disabled) return;
    onChange(clampLineCount(nextValue, min, max, value));
  };

  return (
    <div className={`line-count-control ${disabled ? "line-count-control-disabled" : ""}`}>
      <span className="line-count-control-label">{label}</span>
      <input
        type="range"
        className="form-range line-count-control-slider"
        min={min}
        max={max}
        step={1}
        value={clampLineCount(value, min, max, min)}
        disabled={disabled}
        onChange={(e) => handleValueChange(e.target.value)}
      />
      <input
        type="number"
        className="form-control line-count-control-input"
        min={min}
        max={max}
        step={1}
        value={clampLineCount(value, min, max, min)}
        disabled={disabled}
        onChange={(e) => handleValueChange(e.target.value)}
      />
    </div>
  );
}