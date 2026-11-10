import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth-server";

function validPlaybackState(s: unknown): "idle" | "paused" | "playing" | "buffering" {
  if (s === "playing" || s === "paused" || s === "buffering" || s === "idle") return s;
  return "paused";
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const url = new URL(req.url);
    const roomId = url.searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "roomId obrigatório." }, { status: 400 });
    }

    // Verificar acesso à sala
    const { data: participant } = await supabase
      .from("room_participants")
      .select("id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", session.user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Não autorizado para esta sala." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const currentTime = Number(body.currentTime ?? 0);
    const playbackRate = Number(body.playbackRate ?? 1);
    const playbackState = validPlaybackState(body.playbackState ?? "paused");
    const currentVideoId = body.currentVideoId ? String(body.currentVideoId) : null;
    const actionId = String(body.actionId ?? crypto.randomUUID());

    if (currentVideoId && !/^[A-Za-z0-9_-]{6,20}$/.test(currentVideoId)) {
      return NextResponse.json({ error: "videoId inválido." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("room_state")
      .upsert({
        room_id: roomId,
        current_video_id: currentVideoId,
        playback_state: playbackState,
        current_time_seconds: Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0,
        playback_rate: Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1,
        updated_by: session.user.id,
        action_id: actionId,
        last_action: body.action ?? "sync",
      }, { onConflict: "room_id" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: "Falha ao sincronizar." }, { status: 500 });
    return NextResponse.json({ state: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro de sincronização.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
