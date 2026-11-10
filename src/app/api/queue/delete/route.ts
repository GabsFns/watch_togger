import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { getSoleRoom, requireParticipant } from "@/lib/server/auth";

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("wt_session")?.value;
    const room = await getSoleRoom();
    await requireParticipant(room.id, token);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("video_queue")
      .delete()
      .eq("id", id)
      .eq("room_id", room.id);
    if (error) return NextResponse.json({ error: "Falha ao remover." }, { status: 500 });

    // Reindexa posições
    const { data: remaining } = await supabase
      .from("video_queue")
      .select("id")
      .eq("room_id", room.id)
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
