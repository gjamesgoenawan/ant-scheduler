export function clampLineCount(value, min = 1, max = 500, fallback = min) {
  const normalizedMin = Math.max(1, Math.round(Number(min) || 1));
  const normalizedMax = Math.max(normalizedMin, Math.round(Number(max) || normalizedMin));
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return Math.min(normalizedMax, Math.max(normalizedMin, Math.round(Number(fallback) || normalizedMin)));
  }

  return Math.min(normalizedMax, Math.max(normalizedMin, Math.round(numericValue)));
}

export function takeLastLinesFromText(text, count) {
  if (!text) return "";

  const normalized = String(text).replace(/\r\n/g, "\n");
  const hadTrailingNewline = normalized.endsWith("\n");
  const lines = normalized.split("\n");

  if (hadTrailingNewline) {
    lines.pop();
  }

  const safeCount = Math.max(1, Math.round(Number(count) || 1));
  const sliced = lines.slice(-safeCount);
  const joined = sliced.join("\n");

  if (!joined) {
    return "";
  }

  return hadTrailingNewline ? `${joined}\n` : joined;
}

export function takeLastItems(items, count) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const safeCount = Math.max(1, Math.round(Number(count) || 1));
  return items.slice(-safeCount);
}