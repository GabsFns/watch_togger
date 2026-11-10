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

    // Verificar acesso e buscar participante
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
    const message = String(body.message ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 500);

    if (!message) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        participant_id: participant.id,
        sender_name: participant.participant_name,
        message,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: "Falha ao enviar mensagem." }, { status: 500 });
    return NextResponse.json({ message: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no chat.";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
