import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { getSoleRoom, requireParticipant } from "@/lib/server/auth";
import type { PlaybackState } from "@/lib/types";

function validPlaybackState(s: unknown): PlaybackState {
  if (s === "playing" || s === "paused" || s === "buffering" || s === "idle") return s;
  return "paused";
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("wt_session")?.value;
    const room = await getSoleRoom();
    const participant = await requireParticipant(room.id, token);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "sync");
    const currentTime = Number(body.currentTime ?? 0);
    const playbackRate = Number(body.playbackRate ?? 1);
    const playbackState = validPlaybackState(body.playbackState ?? "paused");
    const currentVideoId = body.currentVideoId ? String(body.currentVideoId) : null;
    const actionId = String(body.actionId ?? cryptoRandomId());

    if (currentVideoId && !/^[A-Za-z0-9_-]{6,20}$/.test(currentVideoId)) {
      return NextResponse.json({ error: "videoId inválido." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("room_state")
      .update({
        current_video_id: currentVideoId,
        playback_state: playbackState,
        current_time_seconds: Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0,
        playback_rate: Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1,
        updated_by: participant.participant_name,
        action_id: actionId,
        last_action: action,
      })
      .eq("room_id", room.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: "Falha ao sincronizar." }, { status: 500 });
    return NextResponse.json({ state: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro de sincronização.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

function cryptoRandomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
