import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth-server";

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const url = new URL(req.url);
    const roomId = url.searchParams.get("roomId");
    const id = url.searchParams.get("id");

    if (!roomId) {
      return NextResponse.json({ error: "roomId obrigatório." }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
    }

    // Verificar acesso (owner ou participant)
    const { data: participant } = await supabase
      .from("room_participants")
      .select("id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", session.user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Não autorizado para esta sala." }, { status: 403 });
    }

    const { error } = await supabase
      .from("video_queue")
      .delete()
      .eq("id", id)
      .eq("room_id", roomId);
    if (error) return NextResponse.json({ error: "Falha ao remover." }, { status: 500 });

    // Reindexar posições
    const { data: remaining } = await supabase
      .from("video_queue")
      .select("id")
      .eq("room_id", roomId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (remaining) {
      for (let i = 0; i < remaining.length; i++) {
        await supabase.from("video_queue").update({ position: i }).eq("id", remaining[i].id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao remover.";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
