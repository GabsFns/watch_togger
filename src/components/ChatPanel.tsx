"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

export function ChatPanel(props: {
  messages: ChatMessage[];
  meName: string | null;
  onSend: (text: string) => Promise<void> | void;
  error: string | null;
}) {
  const { messages, meName, onSend, error } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const v = inputRef.current?.value ?? "";
    if (!v.trim()) return;
    await onSend(v);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#2a2a31] bg-[#16161a]">
      <header className="border-b border-[#2a2a31] px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Chat</h2>
        <p className="text-xs text-zinc-400">Tempo real, independente do vídeo</p>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhuma mensagem ainda. Diga oi 👋</p>
        )}
        {messages.map((m) => {
          const mine = meName && m.sender_name === meName;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${mine ? "bg-zinc-100 text-zinc-900" : "bg-[#1d1d22] text-zinc-100 border border-[#2a2a31]"}`}>
                <div className="mb-0.5 text-[11px] font-medium opacity-70">
                  {m.sender_name} · {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.message}</div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 pb-2 text-xs text-red-300">{error}</p>}

      <form onSubmit={handleSend} className="safe-bottom border-t border-[#2a2a31] p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            name="message"
            maxLength={500}
            placeholder="Mensagem…"
            autoComplete="off"
            className="h-11 flex-1 rounded-xl border border-[#2a2a31] bg-[#0e0e10] px-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500"
          />
          <button type="submit" className="h-11 min-h-[44px] min-w-[44px] touch-manipulation rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-900">
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}
