import type { RoomState } from "@/lib/types";

const DRIFT_THRESHOLD = 2.5; // segundos — evita ajustes constantes

export function newActionId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function driftSeconds(a: number, b: number): number {
  return Math.abs(a - b);
}

export function needsCorrection(localTime: number, remoteTime: number, remoteState: RoomState["playback_state"]): boolean {
  if (remoteState === "playing") {
    return driftSeconds(localTime, remoteTime) > DRIFT_THRESHOLD;
  }
  // pausado: qualquer diferença relevante deve corrigir
  return driftSeconds(localTime, remoteTime) > 0.5;
}

export function computeExpectedRemoteTime(state: RoomState, nowMs: number): number {
  const base = state.current_time_seconds ?? 0;
  if (state.playback_state !== "playing") return base;
  const updatedMs = new Date(state.updated_at).getTime();
  const elapsed = Math.max(0, (nowMs - updatedMs) / 1000);
  return base + elapsed * (state.playback_rate || 1);
}
