export function readBooleanMap(storageKey) {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "boolean")
    );
  } catch (error) {
    console.warn(`Failed to read ${storageKey} from localStorage`, error);
    return {};
  }
}

export function writeBooleanMap(storageKey, value) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write ${storageKey} to localStorage`, error);
  }
}

export function getStoredBoolean(map, key, fallback) {
  return typeof map?.[key] === "boolean" ? map[key] : fallback;
}