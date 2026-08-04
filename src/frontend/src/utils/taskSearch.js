function searchableValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return Object.entries(value)
      .flatMap(([key, entry]) => [key, searchableValue(entry)])
      .join(" ");
  }
  return String(value);
}

export function taskMatchesSearch(task, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = searchableValue(task).toLocaleLowerCase();
  return terms.every((term) => searchableText.includes(term));
}
