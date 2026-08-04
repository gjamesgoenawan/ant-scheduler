export const TASK_SORT_OPTIONS = [
  { value: "completed-desc", label: "Completed: Newest First" },
  { value: "completed-asc", label: "Completed: Oldest First" },
  { value: "name-asc", label: "Task Name: A-Z" },
  { value: "name-desc", label: "Task Name: Z-A" },
  { value: "started-desc", label: "Started: Newest First" },
  { value: "started-asc", label: "Started: Oldest First" },
];

function numericTime(task, type) {
  const time = task.time || {};
  const candidates = type === "completed"
    ? [task.completed_timestamp, time.stop_timestamp, task._stop_time]
    : [task.start_timestamp, time.start_timestamp, task._start_time];
  const value = candidates.find(
    (candidate) => candidate !== null && candidate !== undefined && candidate !== "" && Number.isFinite(Number(candidate))
  );
  return value === undefined ? null : Number(value);
}

function compareNullableNumbers(left, right, direction) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction * (left - right);
}

function compareTaskNames(left, right) {
  const leftParts = String(left || "").toLocaleLowerCase().match(/\d+|\D+/g) || [];
  const rightParts = String(right || "").toLocaleLowerCase().match(/\d+|\D+/g) || [];
  const partCount = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < partCount; index += 1) {
    if (leftParts[index] === undefined) return -1;
    if (rightParts[index] === undefined) return 1;
    if (leftParts[index] === rightParts[index]) continue;
    const leftNumber = /^\d+$/.test(leftParts[index]) ? Number(leftParts[index]) : null;
    const rightNumber = /^\d+$/.test(rightParts[index]) ? Number(rightParts[index]) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}

export function sortTasks(tasks, sortMode = "completed-desc") {
  const [field, order] = sortMode.split("-");
  const direction = order === "asc" ? 1 : -1;

  return [...tasks].sort((left, right) => {
    if (field === "name") {
      return direction * compareTaskNames(left.task_id, right.task_id);
    }

    const comparison = compareNullableNumbers(
      numericTime(left, field === "completed" ? "completed" : "started"),
      numericTime(right, field === "completed" ? "completed" : "started"),
      direction
    );
    if (comparison !== 0) return comparison;
    return compareTaskNames(left.task_id, right.task_id);
  });
}
