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
    const rawUrl = String(body.url ?? "");
    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) return NextResponse.json({ error: "URL do YouTube inválida." }, { status: 400 });

    const title = body.title ? String(body.title).slice(0, 200) : null;

    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from("video_queue")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);

    const { data, error } = await supabase
      .from("video_queue")
      .insert({
        room_id: room.id,
        video_id: videoId,
        video_title: title,
        added_by: participant.participant_name,
        position: count ?? 0,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: "Falha ao adicionar à fila." }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na fila.";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
