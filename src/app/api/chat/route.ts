import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { getSoleRoom, requireParticipant } from "@/lib/server/auth";
import { sanitizeMessage } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("wt_session")?.value;
    const room = await getSoleRoom();
    const participant = await requireParticipant(room.id, token);

    const body = await req.json().catch(() => ({}));
    const message = sanitizeMessage(String(body.message ?? ""));
    if (!message) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: room.id,
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
