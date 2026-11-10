import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const url = new URL(req.url);
    const roomIdParam = url.searchParams.get("roomId");

    // Se roomId não fornecido, buscar a primeira sala do usuário (sole room compatível)
    let roomId = roomIdParam;
    if (!roomId) {
      const { data: rooms } = await supabase
        .from("rooms")
        .select("id")
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (!rooms || rooms.length === 0) {
        return NextResponse.json({ error: "Nenhuma sala encontrada. Crie uma primeira." }, { status: 404 });
      }
      roomId = rooms[0].id;
    }

    // Verificar se o usuário tem acesso à sala (owner ou participant)
    const { data: participant } = await supabase
      .from("room_participants")
      .select("id,participant_name,user_id,guest_token_hash,joined_at,last_seen_at,room_id")
      .eq("room_id", roomId)
      .or(`user_id.eq.${session.user.id},guest_token_hash.is.not.null`)
      .order("joined_at", { ascending: true })
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ error: "Não autorizado para esta sala." }, { status: 403 });
    }

    // Atualizar presença
    await supabase
      .from("room_participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", participant.id);

    // Buscar dados da sala
    const { data: room } = await supabase
      .from("rooms")
      .select("id,name,owner_id,max_participants,invite_expires_at,created_at")
      .eq("id", roomId)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
    }

    const [stateRes, participantsRes, messagesRes, queueRes] = await Promise.all([
      supabase.from("room_state").select("*").eq("room_id", roomId).single(),
      supabase
        .from("room_participants")
        .select("id,user_id,guest_token_hash,participant_name,last_seen_at,created_at,room_id")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true }),
      supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100),
      supabase
        .from("video_queue")
        .select("*")
        .eq("room_id", roomId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    return NextResponse.json({
      room: {
        id: room.id,
        name: room.name,
        owner_id: room.owner_id,
        max_participants: room.max_participants,
        invite_expires_at: room.invite_expires_at,
        created_at: room.created_at,
      },
      me: {
        id: participant.id,
        participant_name: participant.participant_name,
        user_id: participant.user_id,
        is_owner: participant.user_id === session.user.id,
      },
      state: stateRes.data ?? null,
      participants: participantsRes.data ?? [],
      messages: messagesRes.data ?? [],
      queue: queueRes.data ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar sala.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
