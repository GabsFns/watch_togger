import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth-server";
import { supabaseServerWithServiceRole } from "@/lib/auth-server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const name = body.name ? String(body.name).trim().slice(0, 100) : undefined;
    const maxParticipants = body.max_participants
      ? Number(body.max_participants)
      : undefined;

    if (maxParticipants !== undefined && (maxParticipants < 2 || maxParticipants > 10)) {
      return NextResponse.json({ error: "max_participants deve ser entre 2 e 10." }, { status: 400 });
    }

    const serviceRole = supabaseServerWithServiceRole();

    // Verificar se o usuário é o owner
    const { data: existing } = await serviceRole
      .from("rooms")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
    }
    if (existing.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (maxParticipants !== undefined) updateData.max_participants = maxParticipants;

    const { data: room, error } = await serviceRole
      .from("rooms")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ room });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar sala.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;

    const serviceRole = supabaseServerWithServiceRole();

    // Verificar se o usuário é o owner
    const { data: existing } = await serviceRole
      .from("rooms")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
    }
    if (existing.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { error } = await serviceRole.from("rooms").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao deletar sala.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
