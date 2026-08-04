const READ_TIMEOUT_MS = 8000;
const WRITE_TIMEOUT_MS = 30000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function waitBeforeRetry(attempt) {
  return new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
}

export async function fetchWithTimeout(input, options = {}) {
  const {
    timeoutMs,
    retries,
    signal: externalSignal,
    ...fetchOptions
  } = options;
  const method = String(fetchOptions.method || "GET").toUpperCase();
  const isReadRequest = method === "GET" || method === "HEAD";
  const requestTimeout = timeoutMs ?? (isReadRequest ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
  const maxRetries = retries ?? (isReadRequest ? 1 : 0);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) abortFromExternalSignal();
      else externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeout);

    try {
      const response = await fetch(input, { ...fetchOptions, signal: controller.signal });
      if (attempt < maxRetries && RETRYABLE_STATUSES.has(response.status)) {
        await waitBeforeRetry(attempt);
        continue;
      }
      return response;
    } catch (error) {
      if (externalSignal?.aborted) throw error;
      if (attempt < maxRetries) {
        await waitBeforeRetry(attempt);
        continue;
      }
      if (timedOut) {
        throw new Error(`Request timed out after ${Math.round(requestTimeout / 1000)} seconds.`);
      }
      throw new Error("Network request failed. Check the connection and retry.", { cause: error });
    } finally {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    }
  }

  throw new Error("Network request failed.");
}
