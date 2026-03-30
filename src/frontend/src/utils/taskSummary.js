export const getTaskSummary = (data) => {
  const summary = data?.summary;

  const queued = summary?.queued ?? data?.task_queue?.length ?? 0;
  const running = summary?.running ?? data?.task_ongoing?.length ?? 0;
  const completed = summary?.completed ?? data?.task_completed?.length ?? 0;

  return {
    queued,
    running,
    completed,
    tracked: queued + running + completed,
  };
};
