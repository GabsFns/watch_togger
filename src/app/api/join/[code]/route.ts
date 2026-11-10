import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth-server";
import { supabaseServerWithServiceRole } from "@/lib/auth-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    const serviceRole = supabaseServerWithServiceRole();

    // Buscar sala pelo código de convite
    const { data: room, error: roomError } = await serviceRole
      .from("rooms")
      .select("id, name, owner_id, max_participants, invite_code_hash, invite_expires_at")
      .eq("invite_code", code)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Código de convite inválido." }, { status: 404 });
    }

    // Verificar expiração
    if (room.invite_expires_at && new Date(room.invite_expires_at) < new Date()) {
      return NextResponse.json({ error: "Este código de convite expirou." }, { status: 410 });
    }

    // Verificar capacidade
    const { count } = await serviceRole
      .from("room_participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= room.max_participants) {
      return NextResponse.json({ error: "Sala cheia." }, { status: 403 });
    }

    // Se logado, verificar se já é participant
    let participant: any = null;
    if (session?.user) {
      const { data: existing } = await serviceRole
        .from("room_participants")
        .select("id, participant_name, user_id, joined_at")
        .eq("room_id", room.id)
        .eq("user_id", session.user.id)
        .single();
      if (existing) {
        participant = existing;
      }
    }

    // Se não é participant logado, verificar se tem cookie de guest válido
    if (!participant) {
      const guestToken = req.cookies.get(`wt_guest_${room.id}`)?.value;
      if (guestToken) {
        const { createHash } = await import("crypto");
        const guestTokenHash = createHash("sha256").update(guestToken).digest("hex");
        const { data: existing } = await serviceRole
          .from("room_participants")
          .select("id, participant_name, guest_token_hash, joined_at")
          .eq("room_id", room.id)
          .eq("guest_token_hash", guestTokenHash)
          .single();
        if (existing) {
          participant = existing;
        }
      }
    }

    return NextResponse.json({
      room: {
        id: room.id,
        name: room.name,
        owner_id: room.owner_id,
        max_participants: room.max_participants,
      },
      participant: participant ? {
        id: participant.id,
        participant_name: participant.participant_name,
        user_id: participant.user_id,
        is_owner: participant.user_id === session?.user?.id,
        is_guest: !participant.user_id,
      } : null,
      authenticated: !!session?.user,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao validar código.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    const serviceRole = supabaseServerWithServiceRole();
    const body = await req.json().catch(() => ({}));
    const participantName = String(body.participantName ?? "").trim().slice(0, 40);

    if (!participantName) {
      return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
    }

    // Buscar sala pelo código
    const { data: room, error: roomError } = await serviceRole
      .from("rooms")
      .select("id, name, owner_id, max_participants, invite_code_hash, invite_expires_at")
      .eq("invite_code", code)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Código de convite inválido." }, { status: 404 });
    }

    // Verificar expiração
    if (room.invite_expires_at && new Date(room.invite_expires_at) < new Date()) {
      return NextResponse.json({ error: "Este código de convite expirou." }, { status: 410 });
    }

    // Verificar capacidade
    const { count } = await serviceRole
      .from("room_participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= room.max_participants) {
      return NextResponse.json({ error: "Sala cheia." }, { status: 403 });
    }

    let participantId: string;
    let participantNameFinal: string;

    if (session?.user) {
      // Usuário logado
      const { data: existing } = await serviceRole
        .from("room_participants")
        .select("id")
        .eq("room_id", room.id)
        .eq("user_id", session.user.id)
        .single();

      if (existing) {
        // Atualizar presença
        await serviceRole
          .from("room_participants")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
        participantId = existing.id;
        participantNameFinal = existing.participant_name ?? session.user.user_metadata?.full_name ?? session.user.email ?? "Usuário";
      } else {
        const { data: inserted, error: insertError } = await serviceRole
          .from("room_participants")
          .insert({
            room_id: room.id,
            user_id: session.user.id,
            participant_name: participantName || session.user.user_metadata?.full_name || session.user.email || "Usuário",
          })
          .select("id, participant_name")
          .single();
        if (insertError) throw insertError;
        participantId = inserted.id;
        participantNameFinal = inserted.participant_name;
      }
    } else {
      // Convidado — gerar token único
      const { createHash, randomBytes } = await import("crypto");
      const guestToken = randomBytes(32).toString("hex");
      const guestTokenHash = createHash("sha256").update(guestToken).digest("hex");

      const { data: inserted, error: insertError } = await serviceRole
        .from("room_participants")
        .insert({
          room_id: room.id,
          guest_token_hash: guestTokenHash,
          participant_name: participantName || "Convidado",
        })
        .select("id, participant_name")
          .single();
      if (insertError) throw insertError;
      participantId = inserted.id;
      participantNameFinal = inserted.participant_name;

      // Definir cookie de guest (httpOnly, 30 dias)
      const res = NextResponse.json({
        room: {
          id: room.id,
          name: room.name,
          owner_id: room.owner_id,
          max_participants: room.max_participants,
        },
        participant: {
          id: inserted.id,
          participant_name: inserted.participant_name,
          user_id: null,
          is_owner: false,
          is_guest: true,
        },
        guestToken,
      });
      res.cookies.set(`wt_guest_${room.id}`, guestToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    // Usuário logado — redirect direto
    return NextResponse.json({
      room: {
        id: room.id,
        name: room.name,
        owner_id: room.owner_id,
        max_participants: room.max_participants,
      },
      participant: {
        id: participantId,
        participant_name: participantNameFinal,
        user_id: session?.user?.id ?? null,
        is_owner: session?.user?.id === room.owner_id,
        is_guest: false,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao entrar na sala.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
