// Diagnóstico estruturado (console) — nunca logginga segredos.
const isDev = process.env.NODE_ENV === "development";

export function diag(event: string, data?: unknown) {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.debug(`[wt] ${event}`, data ?? "");
}
