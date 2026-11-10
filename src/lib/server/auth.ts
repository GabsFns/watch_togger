import { getSupabaseServer } from "@/lib/supabase";
import { isValidAccessCode } from "@/lib/security";
import { hashToken, generateSessionToken, sanitizeName } from "@/lib/security";

export async function getSoleRoom() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("rooms")
    .select("id,name")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error("Sala não encontrada. Verifique o setup do banco.");
  return data as { id: string; name: string };
}

export async function joinRoom(
  accessCode: string,
  name: string,
  existingSessionToken?: string
) {
  if (!isValidAccessCode(accessCode)) {
    throw new Error("Código de acesso inválido.");
  }
  const cleanName = sanitizeName(name);
  if (!cleanName) throw new Error("Informe seu nome.");

  const room = await getSoleRoom();
  const supabase = getSupabaseServer();

  // Reaproveita sessão existente se válida
  if (existingSessionToken) {
    const existingHash = hashToken(existingSessionToken);
    const { data: existing } = await supabase
      .from("room_participants")
      .select("id,participant_name")
      .eq("room_id", room.id)
      .eq("session_token_hash", existingHash)
      .single();
    if (existing) {
      await supabase
        .from("room_participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
      return {
        room,
        participantId: existing.id,
        participantName: existing.participant_name,
        sessionToken: existingSessionToken,
      };
    }
  }

  // Checa capacidade (2)
  const { count } = await supabase
    .from("room_participants")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) >= 2) throw new Error("Sala cheia (máximo 2 participantes).");

  const token = generateSessionToken();
  const tokenHash = hashToken(token);

  const { data, error } = await supabase
    .from("room_participants")
    .insert({
      room_id: room.id,
      participant_name: cleanName,
      session_token_hash: tokenHash,
    })
    .select("id,participant_name")
    .single();

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      throw new Error("Esse nome já está na sala. Escolha outro nome.");
    }
    if (msg.includes("Sala cheia")) throw new Error("Sala cheia (máximo 2 participantes).");
    throw new Error("Não foi possível entrar na sala.");
  }

  return {
    room,
    participantId: (data as { id: string; participant_name: string }).id,
    participantName: data.participant_name,
    sessionToken: token,
  };
}

export async function requireParticipant(roomId: string, sessionToken?: string | null) {
  if (!sessionToken) throw new Error("Sessão inválida.");
  const supabase = getSupabaseServer();
  const hash = hashToken(sessionToken);
  const { data, error } = await supabase
    .from("room_participants")
    .select("id,participant_name,room_id")
    .eq("room_id", roomId)
    .eq("session_token_hash", hash)
    .single();
  if (error || !data) throw new Error("Sessão inválida.");
  return data as { id: string; participant_name: string; room_id: string };
}

export async function touchPresence(participantId: string) {
  const supabase = getSupabaseServer();
  await supabase
    .from("room_participants")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", participantId);
}
