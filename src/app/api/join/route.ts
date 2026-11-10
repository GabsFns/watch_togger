import { NextRequest, NextResponse } from "next/server";
import { joinRoom } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accessCode = String(body.accessCode ?? "");
    const name = String(body.name ?? "");
    const existingSessionToken = body.existingSessionToken
      ? String(body.existingSessionToken)
      : undefined;

    const result = await joinRoom(accessCode, name, existingSessionToken);
    const res = NextResponse.json({
      room: result.room,
      participantId: result.participantId,
      participantName: result.participantName,
    });
    res.cookies.set("wt_session", result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao entrar na sala.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
