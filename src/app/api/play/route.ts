import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { getSoleRoom, requireParticipant } from "@/lib/server/auth";
import { extractYouTubeVideoId } from "@/lib/youtube";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("wt_session")?.value;
    const room = await getSoleRoom();
    const participant = await requireParticipant(room.id, token);

    const body = await req.json().catch(() => ({}));
    const rawUrl = body.url ? String(body.url) : "";
    const videoId = body.videoId
      ? String(body.videoId)
      : rawUrl
      ? extractYouTubeVideoId(rawUrl)
      : extractYouTubeVideoId(String(body.id ?? ""));
    if (!videoId) return NextResponse.json({ error: "Vídeo inválido." }, { status: 400 });

    const supabase = getSupabaseServer();
    await supabase
      .from("room_state")
      .update({
        current_video_id: videoId,
        playback_state: "paused",
        current_time_seconds: 0,
        playback_rate: 1,
        updated_by: participant.participant_name,
        action_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        last_action: "load_video",
      })
      .eq("room_id", room.id);

    return NextResponse.json({ ok: true, videoId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao selecionar vídeo.";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
