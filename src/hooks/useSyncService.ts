"use client";

import { useEffect, useRef, useCallback } from "react";
import type { RoomState, PlaybackState } from "@/lib/types";
import { newActionId } from "@/lib/sync";
import { diag } from "@/lib/diag";

/**
 * Serviço de sincronização (client-side).
 * - push(action) envia estado relevante via API (nunca a cada segundo).
 * - applyRemote(state, player) aplica estado remoto no player local,
 *   com tolerância de drift e proteção contra loops via actionId.
 */
export function useSyncService(opts: {
  roomId: string | null;
  isLeader: () => boolean;
  getLocalState: () => {
    currentVideoId: string | null;
    playbackState: PlaybackState;
    currentTime: number;
    playbackRate: number;
  };
  applyRemote: (state: RoomState) => void;
  onError?: (msg: string) => void;
}) {
  const lastSeenActionId = useRef<string | null>(null);
  const busyRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const push = useCallback(
    async (action: string, overrides?: Partial<{ currentVideoId: string | null; playbackState: PlaybackState; currentTime: number; playbackRate: number }>) => {
      const { roomId, getLocalState, onError } = optsRef.current;
      if (!roomId || busyRef.current) return;
      busyRef.current = true;
      try {
        const local = getLocalState();
        const payload = {
          action,
          currentVideoId: overrides?.currentVideoId ?? local.currentVideoId,
          playbackState: overrides?.playbackState ?? local.playbackState,
          currentTime: overrides?.currentTime ?? local.currentTime,
          playbackRate: overrides?.playbackRate ?? local.playbackRate,
          actionId: newActionId(),
        };
        diag("sync.push", { action, video: payload.currentVideoId, state: payload.playbackState });
        const res = await fetch("/api/state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          diag("sync.push.error", res.status);
          const j = await res.json().catch(() => ({}));
          onError?.(j.error ?? "Falha ao sincronizar.");
        }
      } catch (e) {
        diag("sync.push.catch", e);
        onError?.("Sem conexão para sincronizar.");
      } finally {
        busyRef.current = false;
      }
    },
    []
  );

  const filterRemote = useCallback((state: RoomState): boolean => {
    // Retorna true se deve aplicar (novo actionId e não é nosso eco)
    if (!state.action_id) return false;
    if (state.action_id === lastSeenActionId.current) return false;
    lastSeenActionId.current = state.action_id;
    return true;
  }, []);

  const markSeen = useCallback((actionId: string | null) => {
    if (actionId) lastSeenActionId.current = actionId;
  }, []);

  useEffect(() => {
    // Heartbeat de presença
    const t = setInterval(() => {
      fetch("/api/presence", { method: "POST" }).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return { push, filterRemote, markSeen };
}
