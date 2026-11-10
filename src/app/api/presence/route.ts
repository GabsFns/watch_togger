import { NextRequest, NextResponse } from "next/server";
import { getSoleRoom, requireParticipant, touchPresence } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("wt_session")?.value;
    const room = await getSoleRoom();
    const participant = await requireParticipant(room.id, token);
    await touchPresence(participant.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro de presença.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
