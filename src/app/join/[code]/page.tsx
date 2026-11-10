"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<any | null>(null);
  const [participant, setParticipant] = useState<any | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { code: c } = await params;
      setCode(c);
      try {
        const res = await fetch(`/api/join/${c}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "Código inválido.");
          setLoading(false);
          return;
        }
        const json = await res.json();
        setRoom(json.room);
        setParticipant(json.participant);
        setAuthenticated(json.authenticated ?? false);
        if (json.participant) {
          setParticipantName(json.participant.participant_name);
        }
      } catch (e: any) {
        setError(e?.message ?? "Erro ao validar código.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  useEffect(() => {
    if (participant && !loading && !error) {
      const redirectTo = searchParams.get("redirectTo") ?? `/room/${room?.id}`;
      router.push(redirectTo);
    }
  }, [participant, loading, error, room, router, searchParams]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/join/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: participantName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Falha ao entrar na sala.");
        return;
      }
      const redirectTo = searchParams.get("redirectTo") ?? `/room/${json.room.id}`;
      router.push(redirectTo);
    } catch (e: any) {
      setError(e?.message ?? "Falha de rede.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="safe-top mx-auto flex min-h-dvh items-center justify-center px-6">
        <div className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-zinc-100">
          Validando código…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="safe-top mx-auto flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-xl font-bold text-red-300">Código inválido</h1>
        <p className="text-sm text-zinc-400">{error}</p>
        <a href="/" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900">
          Voltar ao acesso
        </a>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  if (participant) {
    return (
      <div className="safe-top mx-auto flex min-h-dvh items-center justify-center px-6">
        <div className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-zinc-100">
          Entrando na sala…
        </div>
      </div>
    );
  }

  return (
    <div className="safe-top mx-auto flex min-h-dvh flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Entrar na sala</h1>
        <p className="mt-2 text-sm text-zinc-400">{room.name}</p>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3 rounded-2xl border border-[#2a2a31] bg-[#16161a] p-5">
        <label className="text-xs font-medium text-zinc-400">Seu nome</label>
        <input
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          placeholder="Seu nome"
          maxLength={40}
          required
          autoComplete="name"
          className="h-12 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-4 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        {authenticated ? (
          <p className="text-xs text-emerald-300">Você está logado(a). O nome será salvo no seu perfil.</p>
        ) : (
          <p className="text-xs text-zinc-500">Você entrará como convidado nesta sala.</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] min-w-[44px] touch-manipulation rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar na sala"}
        </button>
      </form>

      <div className="text-center">
        <a href="/" className="text-xs text-zinc-500 underline">Voltar ao acesso</a>
      </div>
    </div>
  );
}
