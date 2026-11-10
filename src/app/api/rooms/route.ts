import { NextRequest, NextResponse } from "next/server";
import { supabaseServerWithServiceRole } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const serviceRole = supabaseServerWithServiceRole();
    const { data: rooms, error } = await serviceRole
      .from("rooms")
      .select(`
        *,
        room_participants (
          id, user_id, participant_name, joined_at
        )
      `)
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const roomsWithCount = (rooms ?? []).map((r: any) => ({
      ...r,
      participant_count: (r.room_participants ?? []).length,
      room_participants: undefined,
    }));

    return NextResponse.json({ rooms: roomsWithCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar salas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "Minha Sala").trim().slice(0, 100);
    const maxParticipants = Number(body.max_participants ?? 2);

    if (maxParticipants < 2 || maxParticipants > 10) {
      return NextResponse.json({ error: "max_participants deve ser entre 2 e 10." }, { status: 400 });
    }

    // Gerar código de convite único
    const inviteCode = `${session.user.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
    const { createHash } = await import("crypto");
    const inviteCodeHash = createHash("sha256").update(inviteCode).digest("hex");

    const expiresInHours = Number(body.expires_in_hours ?? 0);
    const inviteExpiresAt = expiresInHours > 0
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const serviceRole = supabaseServerWithServiceRole();
    const { data: room, error } = await serviceRole
      .from("rooms")
      .insert({
        owner_id: session.user.id,
        name,
        max_participants: maxParticipants,
        invite_code_hash: inviteCodeHash,
        invite_expires_at: inviteExpiresAt,
      })
      .select()
      .single();

    if (error) throw error;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/join/${inviteCode}`;

    return NextResponse.json({
      room: {
        ...room,
        invite_code: inviteCode,
        invite_url: inviteUrl,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao criar sala.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
