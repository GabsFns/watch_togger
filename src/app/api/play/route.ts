import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
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

    // Verificar acesso
    const { data: participant } = await supabase
      .from("room_participants")
      .select("id,user_id,participant_name")
      .eq("room_id", roomId)
      .eq("user_id", session.user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Não autorizado para esta sala." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const videoId = body.videoId ? String(body.videoId) : "";

    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      return NextResponse.json({ error: "Vídeo inválido." }, { status: 400 });
    }

    const { error } = await supabase
      .from("room_state")
      .upsert({
        room_id: roomId,
        current_video_id: videoId,
        playback_state: "paused",
        current_time_seconds: 0,
        playback_rate: 1,
        updated_by: session.user.id,
        action_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        last_action: "load_video",
      }, { onConflict: "room_id" });

    if (error) return NextResponse.json({ error: "Falha ao carregar vídeo." }, { status: 500 });

    return NextResponse.json({ ok: true, videoId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao selecionar vídeo.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
