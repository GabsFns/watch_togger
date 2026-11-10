"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      router.push("/room");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao autenticar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="safe-top mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-2 text-sm text-zinc-400">Watch Together — sala privada para vocês dois</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-[#2a2a31] bg-[#16161a] p-5">
        <label className="text-xs font-medium text-zinc-400">E-mail</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="seu@email.com"
          required
          autoComplete="email"
          className="h-12 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-4 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <label className="text-xs font-medium text-zinc-400">Senha</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
          minLength={6}
          required
          autoComplete="new-password"
          className="h-12 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-4 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] min-w-[44px] touch-manipulation rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
        >
          {loading ? "Processando…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        <p className="text-center text-xs text-zinc-500">
          {mode === "login"
            ? "Não tem conta? "
            : "Já tem conta? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-emerald-300 hover:text-emerald-200 underline"
          >
            {mode === "login" ? "Cadastre-se" : "Faça login"}
          </button>
        </p>
      </form>
    </div>
  );
}
