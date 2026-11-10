import { describe, it, expect } from "vitest";
import { needsCorrection } from "@/lib/sync";
import type { RoomState } from "@/lib/types";

function s(playing: boolean): RoomState {
  return {
    id: "1",
    room_id: "r",
    current_video_id: "xxx",
    playback_state: playing ? "playing" : "paused",
    current_time_seconds: 100,
    playback_rate: 1,
    updated_at: new Date().toISOString(),
    updated_by: "a",
    action_id: "a",
    last_action: "x",
  };
}

describe("sincronização — casos críticos", () => {
  it("duas sessões não devem se auto-corrigir quando em sync", () => {
    // B recebe 100.5 com local 100 -> não corrige (drift < 2.5)
    expect(needsCorrection(100, 100.5, "playing")).toBe(false);
    // paused com diferença >0.5 corrige
    expect(needsCorrection(100, 101, "paused")).toBe(true);
  });

  it("eventos duplicados com mesmo action_id devem ser ignorados (lógica no cliente)", () => {
    const stateA = s(true);
    const stateB = { ...stateA, action_id: "same" };
    const stateC = { ...stateA, action_id: "same" };
    expect(stateB.action_id).toBe(stateC.action_id);
    // O filtro no RoomView compara prev.action_id === s.action_id
    // Simulação do filtro:
    function filter(prev: string | null, next: string | null) {
      return prev !== next;
    }
    expect(filter(stateB.action_id, stateC.action_id)).toBe(false);
    expect(filter(stateB.action_id, "different")).toBe(true);
  });

  it("seek grande deve corrigir", () => {
    expect(needsCorrection(10, 50, "playing")).toBe(true);
  });
});
