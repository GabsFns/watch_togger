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

    const body = await req.json().catch(() => ({}));
    const rawUrl = String(body.url ?? "");
    const videoId = body.videoId ? String(body.videoId) : rawUrl ? extractYouTubeVideoId(rawUrl) : extractYouTubeVideoId(String(body.id ?? ""));

    if (!videoId) return NextResponse.json({ error: "URL do YouTube inválida." }, { status: 400 });

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

    const title = body.title ? String(body.title).slice(0, 200) : null;

    // Contar itens existentes para posição
    const { count } = await supabase
      .from("video_queue")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId);

    const { data, error } = await supabase
      .from("video_queue")
      .insert({
        room_id: roomId,
        video_id: videoId,
        video_title: title,
        added_by_participant_id: participant.id,
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

function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{6,20}$/.test(trimmed) && !trimmed.includes("/") && !trimmed.includes("?") && !trimmed.includes("&")) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      const id = url.pathname.split("/")[1];
      return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{6,20}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const kind = parts[0].toLowerCase();
        if (["shorts", "embed", "live", "v"].includes(kind)) {
          const id = parts[1];
          return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}
