import { describe, it, expect } from "vitest";
import {
  driftSeconds,
  needsCorrection,
  computeExpectedRemoteTime,
  newActionId,
} from "@/lib/sync";
import type { RoomState } from "@/lib/types";

function baseState(partial: Partial<RoomState> = {}): RoomState {
  return {
    id: "1",
    room_id: "r1",
    current_video_id: "dQw4w9WgXcQ",
    playback_state: "playing",
    current_time_seconds: 100,
    playback_rate: 1,
    updated_at: new Date().toISOString(),
    updated_by: "Ana",
    action_id: "a1",
    last_action: "play",
    ...partial,
  };
}

describe("sync", () => {
  it("driftSeconds calcula diferença absoluta", () => {
    expect(driftSeconds(10, 12)).toBe(2);
    expect(driftSeconds(12, 10)).toBe(2);
  });

  it("needsCorrection respeita tolerância de 2.5s em playing", () => {
    expect(needsCorrection(100, 101, "playing")).toBe(false);
    expect(needsCorrection(100, 103, "playing")).toBe(true);
  });

  it("needsCorrection em paused é mais estrita", () => {
    expect(needsCorrection(100, 100.3, "paused")).toBe(false);
    expect(needsCorrection(100, 101, "paused")).toBe(true);
  });

  it("computeExpectedRemoteTime avança com elapsed", () => {
    const s = baseState({ updated_at: new Date(Date.now() - 10000).toISOString(), current_time_seconds: 100 });
    const expected = computeExpectedRemoteTime(s, Date.now());
    expect(expected).toBeGreaterThan(105);
    expect(expected).toBeLessThan(115);
  });

  it("computeExpectedRemoteTime não avança quando pausado", () => {
    const s = baseState({ playback_state: "paused", current_time_seconds: 42 });
    expect(computeExpectedRemoteTime(s, Date.now())).toBe(42);
  });

  it("newActionId gera IDs únicos", () => {
    const a = newActionId();
    const b = newActionId();
    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
  });
});
