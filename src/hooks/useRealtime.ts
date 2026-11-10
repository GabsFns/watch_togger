"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";
import { diag } from "@/lib/diag";
import type { ChatMessage, QueueItem, RoomState, Participant } from "@/lib/types";

export function useRealtime(opts: {
  roomId: string | null;
  onState: (s: RoomState) => void;
  onMessage: (m: ChatMessage) => void;
  onQueue: (items: QueueItem[]) => void;
  onParticipants: (p: Participant[]) => void;
}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!opts.roomId) return;
    let supabase: ReturnType<typeof getSupabaseBrowser>;
    try {
      supabase = getSupabaseBrowser();
    } catch (e) {
      diag("realtime.supabase.error", e);
      return;
    }

    const channel = supabase.channel(`room-${opts.roomId}`);

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_state", filter: `room_id=eq.${opts.roomId}` },
        (payload: any) => {
          diag("realtime.state", payload.eventType);
          if (payload.new) optsRef.current.onState(payload.new as RoomState);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${opts.roomId}` },
        (payload: any) => {
          diag("realtime.message");
          if (payload.new) optsRef.current.onMessage(payload.new as ChatMessage);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_queue", filter: `room_id=eq.${opts.roomId}` },
        async () => {
          const { data } = await supabase
            .from("video_queue")
            .select("*")
            .eq("room_id", opts.roomId!)
            .order("position")
            .order("created_at");
          if (data) optsRef.current.onQueue(data as QueueItem[]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${opts.roomId}` },
        async () => {
          const { data } = await supabase
            .from("room_participants")
            .select("id,participant_name,last_seen_at,created_at,room_id")
            .eq("room_id", opts.roomId!)
            .order("created_at");
          if (data) optsRef.current.onParticipants(data as Participant[]);
        }
      )
      .subscribe((status: string) => {
        diag("realtime.subscribe", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opts.roomId]);
}
