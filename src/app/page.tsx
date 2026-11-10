"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), accessCode: accessCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Não foi possível entrar.");
        return;
      }
      router.replace("/room");
      router.refresh();
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="safe-top mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Watch Together</h1>
        <p className="mt-2 text-sm text-zinc-400">Sala privada para vocês dois. Sincronizados, no mesmo momento.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-[#2a2a31] bg-[#16161a] p-5">
        <label className="text-xs font-medium text-zinc-400">Seu nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Gabriel"
          maxLength={40}
          required
          className="h-12 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-4 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          autoComplete="name"
        />
        <label className="text-xs font-medium text-zinc-400">Código de acesso</label>
        <input
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          placeholder="Código da sala"
          required
          inputMode="text"
          className="h-12 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-4 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-900 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar na sala"}
        </button>
        <p className="text-center text-xs text-zinc-500">Máximo 2 pessoas. Sua identidade fica salva neste aparelho.</p>
      </form>
    </div>
  );
}
