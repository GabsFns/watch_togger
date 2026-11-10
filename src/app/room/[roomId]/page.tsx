import { Suspense } from "react";
import RoomView from "@/app/room/RoomView";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return (
    <Suspense fallback={
      <div className="safe-top mx-auto flex min-h-dvh items-center justify-center px-6">
        <div className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-zinc-100">
          Carregando sala…
        </div>
      </div>
    }>
      <RoomView roomId={roomId} />
    </Suspense>
  );
}
