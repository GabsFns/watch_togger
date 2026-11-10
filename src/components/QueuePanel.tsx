"use client";

import type { QueueItem } from "@/lib/types";
import { youtubeThumbnailUrl } from "@/lib/youtube";

export function QueuePanel(props: {
  queue: QueueItem[];
  currentVideoId: string | null;
  onSelect: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => void;
  error: string | null;
}) {
  const { queue, currentVideoId, onSelect, onRemove, error } = props;
  return (
    <section className="rounded-2xl border border-[#2a2a31] bg-[#16161a] p-3">
      <header className="mb-2 px-1">
        <h2 className="text-sm font-semibold text-zinc-100">Fila</h2>
        <p className="text-xs text-zinc-400">Toque para assistir</p>
      </header>
      {queue.length === 0 && <p className="px-1 py-2 text-sm text-zinc-500">Fila vazia.</p>}
      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-[#2a2a31] bg-[#0e0e10] p-2">
              <img src={youtubeThumbnailUrl(it.video_id)} alt="" className="h-12 w-[72px] shrink-0 rounded-lg object-cover" loading="lazy" />
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => onSelect(it)}
                  className={`block w-full truncate text-left text-sm font-medium ${it.video_id === currentVideoId ? "text-emerald-300" : "text-zinc-100"}`}
                >
                  {it.video_title ?? it.video_id}
                </button>
                <p className="text-xs text-zinc-500">por {it.added_by ?? "—"}</p>
              </div>
              <button
                onClick={() => onRemove(it)}
                aria-label="Remover da fila"
                className="rounded-lg border border-[#2a2a31] px-2 py-1 text-xs text-zinc-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 px-1 text-xs text-red-300">{error}</p>}
    </section>
  );
}
