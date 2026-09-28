import { AsyncLocalStorage } from "node:async_hooks";
const scope = new AsyncLocalStorage<AbortSignal>();
export function jobSignal(timeout: number) {
  const signal = scope.getStore();
  if (signal?.aborted) throw new Error("JOB_DEADLINE_EXCEEDED");
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
}
export async function withJobDeadline<T>(work: () => Promise<T>, milliseconds = 540_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await scope.run(controller.signal, work); } finally { clearTimeout(timer); }
}
