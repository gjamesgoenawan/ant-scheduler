import { API_URL } from "../App";

function parseLogResponseBody(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export async function fetchLogContent(taskId, options = {}) {
  const params = new URLSearchParams({
    task_id: taskId,
  });

  if (options.fullLog) {
    params.set("full_log", "true");
  }

  if (options.tailLines) {
    params.set("tail_lines", String(options.tailLines));
  }

  const response = await fetch(`${API_URL}/get_log?${params.toString()}`);
  const rawText = await response.text();
  const payload = parseLogResponseBody(rawText);

  if (!response.ok) {
    throw new Error(
      payload?.message || payload?.data || rawText.trim() || `Failed to load logs (status ${response.status}).`
    );
  }

  if (payload && typeof payload === "object") {
    if (payload.status === "success") {
      return payload.data || "";
    }

    if (typeof payload.data === "string" && !payload.message) {
      return payload.data;
    }

    throw new Error(payload.message || payload.data || "Failed to load logs.");
  }

  return rawText;
}