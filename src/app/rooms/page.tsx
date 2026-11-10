"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/auth-client";
import { formatTime } from "@/lib/youtube";

export default function RoomsDashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState("2");

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      setLoading(true);
      const res = await fetch("/api/rooms", {
        headers: { Authorization: `Bearer ${(await supabaseBrowser().auth.getSession()).data.session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar salas.");
      const json = await res.json();
      setRooms(json.rooms ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar salas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const max = Number(newMax);
    if (max < 2 || max > 10) {
      setError("max_participants deve ser entre 2 e 10.");
      return;
    }
    try {
      setCreating(true);
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName || "Minha Sala", max_participants: max }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao criar sala.");
      }
      const json = await res.json();
      setRooms((prev) => [json.room, ...prev]);
      setNewName("");
      setNewMax("2");
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar sala.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(roomId: string) {
    if (!confirm("Tem certeza que deseja excluir esta sala?")) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir.");
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (e: any) {
      setError(e?.message ?? "Falha ao excluir sala.");
    }
  }

  async function handleUpdate(roomId: string, field: string, value: any) {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar.");
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, [field]: value } : r)));
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar sala.");
    }
  }

  if (loading) {
    return (
      <div className="safe-top mx-auto flex min-h-dvh items-center justify-center px-6">
        <div className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-zinc-100">
          Carregando salas…
        </div>
      </div>
    );
  }

  return (
    <div className="safe-top mx-auto flex min-h-dvh flex-col gap-4 px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Minhas Salas</h1>
          <p className="text-sm text-zinc-400">Gerencie suas salas privadas</p>
        </div>
        <a
          href="/room"
          className="min-h-[44px] min-w-[44px] touch-manipulation rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900"
        >
          Entrar em sala existente
        </a>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-[#2a2a31] bg-[#16161a] p-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da sala"
          maxLength={100}
          className="h-12 flex-1 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-4 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <input
          value={newMax}
          onChange={(e) => setNewMax(e.target.value)}
          type="number"
          min="2"
          max="10"
          placeholder="2"
          className="h-12 w-20 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-4 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="min-h-[44px] min-w-[44px] touch-manipulation rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
        >
          {creating ? "Criando…" : "Criar sala"}
        </button>
      </form>

      {rooms.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
          <p className="text-sm text-zinc-400">Nenhuma sala ainda. Crie a primeira acima.</p>
        </div>
      )}

      {rooms.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a31] text-left">
                <th className="pb-3 text-xs text-zinc-500 font-medium">Sala</th>
                <th className="pb-3 text-xs text-zinc-500 font-medium">Participantes</th>
                <th className="pb-3 text-xs text-zinc-500 font-medium">Criada em</th>
                <th className="pb-3 text-xs text-zinc-500 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-[#2a2a31] hover:bg-[#1d1d22]/50">
                  <td className="py-3">
                    <div className="font-medium text-zinc-100">{room.name}</div>
                    <div className="text-xs text-zinc-500 truncate" title={room.invite_url}>
                      {room.invite_url}
                    </div>
                  </td>
                  <td className="py-3 text-sm text-zinc-100">
                    {room.participant_count} / {room.max_participants}
                  </td>
                  <td className="py-3 text-xs text-zinc-500">
                    {new Date(room.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-3 text-right text-sm">
                    <button
                      onClick={() => handleUpdate(room.id, "name", prompt("Novo nome:", room.name))}
                      className="mr-2 text-xs text-emerald-300 hover:text-emerald-200 underline"
                    >
                      Editar nome
                    </button>
                    <button
                      onClick={() => {
                        const max = prompt("Novo limite (2-10):", String(room.max_participants));
                        if (max) handleUpdate(room.id, "max_participants", Number(max));
                      }}
                      className="mr-2 text-xs text-emerald-300 hover:text-emerald-200 underline"
                    >
                      Editar limite
                    </button>
                    <a
                      href={`/room/${room.id}`}
                      className="mr-2 text-xs text-zinc-100 underline"
                    >
                      Abrir
                    </a>
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="text-xs text-red-300 hover:text-red-200 underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
