import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { getSoleRoom, requireParticipant, touchPresence } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("wt_session")?.value;
    const url = new URL(req.url);
    const roomIdParam = url.searchParams.get("roomId");
    const room = roomIdParam
      ? { id: roomIdParam, name: "Sala privada" }
      : await getSoleRoom();

    const participant = await requireParticipant(room.id, token);
    await touchPresence(participant.id);

    const supabase = getSupabaseServer();
    const [stateRes, participantsRes, messagesRes, queueRes] = await Promise.all([
      supabase.from("room_state").select("*").eq("room_id", room.id).single(),
      supabase
        .from("room_participants")
        .select("id,participant_name,last_seen_at,created_at,room_id")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })
        .limit(100),
      supabase
        .from("video_queue")
        .select("*")
        .eq("room_id", room.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    return NextResponse.json({
      room,
      me: participant,
      state: stateRes.data ?? null,
      participants: participantsRes.data ?? [],
      messages: messagesRes.data ?? [],
      queue: queueRes.data ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar sala.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
