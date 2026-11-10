"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Participant, QueueItem, RoomState } from "@/lib/types";
import { parseYouTubeUrl, formatTime } from "@/lib/youtube";
import { VideoPlayer, type VideoPlayerHandle, type PlayerStatus } from "@/components/VideoPlayer";
import { ChatPanel } from "@/components/ChatPanel";
import { QueuePanel } from "@/components/QueuePanel";
import { useRealtime } from "@/hooks/useRealtime";
import { useSyncService } from "@/hooks/useSyncService";
import { diag } from "@/lib/diag";

interface RoomPayload {
  room: { id: string; name: string };
  me: { id: string; participant_name: string };
  state: RoomState | null;
  participants: Participant[];
  messages: ChatMessage[];
  queue: QueueItem[];
}

export default function RoomView() {
  const [data, setData] = useState<RoomPayload | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [manualStart, setManualStart] = useState(false); // iOS: precisa de gesto
  const manualStartRef = useRef(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"video" | "chat">("video");

  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const applyingRemoteRef = useRef(false);
  const lastLocalActionAtRef = useRef(0);
  const stateRef = useRef<RoomState | null>(null);
  stateRef.current = state;
  const playerStatusRef = useRef<PlayerStatus>("EMPTY");
  const videoIdRef = useRef<string | null>(null);
  videoIdRef.current = videoId;

  const { push, markSeen } = useSyncService({
    roomId: data?.room.id ?? null,
    isLeader: () => true,
    getLocalState: () => ({
      currentVideoId: videoId,
      playbackState: state?.playback_state === "playing" ? "playing" : "paused",
      currentTime: playerRef.current?.getCurrentTime() ?? currentTime,
      playbackRate: 1,
    }),
    applyRemote: () => {},
    onError: setError,
  });

  const loadRoom = useCallback(async () => {
    const res = await fetch("/api/room", { credentials: "include" });
    if (!res.ok) {
      setError("Não autorizado. Entre novamente.");
      return;
    }
    const json = (await res.json()) as RoomPayload;
    setData(json);
    setState(json.state);
    setParticipants(json.participants);
    setMessages(json.messages);
    setQueue(json.queue);
    if (json.state?.current_video_id) setVideoId(json.state.current_video_id);
    if (json.state?.action_id) markSeen(json.state.action_id);
    setAuthorized(true);
  }, [markSeen]);

  useEffect(() => {
    loadRoom().catch(() => setError("Falha ao carregar a sala."));
    // Reconciliação periódica (fallback caso Realtime caia)
    const t = setInterval(loadRoom, 20000);
    return () => clearInterval(t);
  }, [loadRoom]);

  useRealtime({
    roomId: data?.room.id ?? null,
    onState: (s) => {
      setState(prev => {
        if (prev?.action_id === s.action_id) return prev;
        return s;
      });
    },
    onMessage: (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    },
    onQueue: (items) => setQueue(items),
    onParticipants: (p) => setParticipants(p),
  });

  // Aplica estado remoto no player local — simples, igual ao debug.
  // Só muda o vídeo (VideoPlayer cue sozinho) e play/pause. Sem seek forçado.
  const applyRemoteState = useCallback((s: RoomState) => {
    const player = playerRef.current;
    if (!player?.ready) {
      diag("room.applyRemote.notReady");
      return;
    }
    if (!s.current_video_id) return;
    // Mudança de vídeo: o VideoPlayer faz cue via efeito próprio.
    if (s.current_video_id !== videoIdRef.current) {
      setVideoId(s.current_video_id);
      return;
    }
    // Play/pause: só reproduz se o usuário já deu o gesto local.
    if (s.playback_state === "playing") {
      if (manualStartRef.current) {
        try { player.play(); } catch {}
      }
    } else if (s.playback_state === "paused") {
      try { player.pause(); } catch {}
    }
    markSeen(s.action_id);
  }, [markSeen]);

  useEffect(() => {
    if (!state) return;
    // Evita aplicar eco do nosso próprio push nos primeiros 1.5s
    if (Date.now() - lastLocalActionAtRef.current < 1500) return;
    applyRemoteState(state);
  }, [state, applyRemoteState]);

  // Presence online/offline (30s)
  const presence = participants.map((p) => ({
    ...p,
    online: Date.now() - new Date(p.last_seen_at).getTime() < 30000,
  }));

  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    // Parser extrai SOMENTE o videoId; timestamp (t=) é preservado só
    // como startSeconds local — nunca faz parte da ID enviada ao player.
    const parsed = parseYouTubeUrl(urlInput);
    if (!parsed) {
      setError("Cole um link válido do YouTube (watch?v=, youtu.be/, embed/ ou ID).");
      return;
    }
    const id = parsed.videoId;
    const startAt = parsed.startSeconds ?? 0;
    setError(null);
    // Adiciona à fila
    const resQ = await fetch("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput, videoId: id }),
    });
    if (!resQ.ok) {
      const j = await resQ.json().catch(() => ({}));
      setQueueError(j.error ?? "Falha ao adicionar.");
      return;
    }
    // Carrega como vídeo atual. O timestamp inicial é aplicado localmente
    // via cue+seek e NÃO entra na sincronização (room_state começa em 0).
    const resPlay = await fetch("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: id }),
    });
    if (resPlay.ok) {
      setVideoId(id);
      if (startAt > 0) {
        // Único seek local — não dispara push de sincronização.
        setTimeout(() => { try { playerRef.current?.seekTo(startAt); } catch {} }, 900);
      }
      await push("load_video", { currentVideoId: id, playbackState: "paused", currentTime: 0 });
    }
    setUrlInput("");
  }

  async function handleSendMessage(text: string) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setChatError(j.error ?? "Falha ao enviar.");
    } else {
      setChatError(null);
    }
  }

  async function handleSelectQueue(item: QueueItem) {
    const res = await fetch("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: item.video_id }),
    });
    if (res.ok) {
      setVideoId(item.video_id);
      await push("load_video", { currentVideoId: item.video_id, playbackState: "paused", currentTime: 0 });
    } else {
      const j = await res.json().catch(() => ({}));
      setQueueError(j.error ?? "Falha ao selecionar.");
    }
  }

  async function handleRemoveQueue(item: QueueItem) {
    const res = await fetch(`/api/queue/delete?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setQueueError(j.error ?? "Falha ao remover.");
    }
  }

  if (!authorized) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold">Watch Together</h1>
        <p className="text-center text-sm text-zinc-400">Esta tela aparece quando você ainda não entrou na sala.</p>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <a href="/" className="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900">Voltar ao acesso</a>
      </div>
    );
  }

  return (
    <div className="safe-top mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2a2a31] bg-[#16161a] px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">{data?.room.name ?? "Sala privada"}</h1>
          <p className="text-xs text-zinc-400">Watch Together — sala para 2 pessoas</p>
        </div>
        <div className="flex items-center gap-2">
          {presence.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#2a2a31] bg-[#0e0e10] px-3 py-1 text-xs text-zinc-200">
              <span className={`h-2 w-2 rounded-full ${p.online ? "bg-emerald-400" : "bg-zinc-600"}`} />
              {p.participant_name}
              <span className="text-zinc-500">{p.online ? "online" : "off"}</span>
            </span>
          ))}
          {presence.length === 0 && <span className="text-xs text-zinc-500">Você está sozinho(a) aqui</span>}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Add video */}
      <form onSubmit={addVideo} className="flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Cole o link do YouTube…"
          inputMode="url"
          className="h-12 flex-1 rounded-xl border border-[#2a2a31] bg-[#16161a] px-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500"
        />
        <button type="submit" className="h-12 shrink-0 rounded-xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-900">
          Adicionar
        </button>
      </form>

      {/* Mobile tabs */}
      <div className="flex gap-2 sm:hidden">
        <button
          onClick={() => setActiveTab("video")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm ${activeTab === "video" ? "bg-zinc-100 text-zinc-900 font-semibold" : "border border-[#2a2a31] text-zinc-200"}`}
        >
          Vídeo
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm ${activeTab === "chat" ? "bg-zinc-100 text-zinc-900 font-semibold" : "border border-[#2a2a31] text-zinc-200"}`}
        >
          Chat
        </button>
      </div>

      {/* Main layout: desktop 2 colunas; mobile empilhado */}
      <div className="grid flex-1 gap-4 md:grid-cols-[1fr_340px] md:min-h-0">
        <div className={activeTab === "chat" ? "hidden md:flex md:flex-col md:gap-4" : "flex flex-col gap-4"}>
          <VideoPlayer
            handleRef={playerRef}
            videoId={videoId}
            events={{
              onReady: () => {
                diag("player.onReady");
                setPlayerReady(true);
                if (stateRef.current) applyRemoteState(stateRef.current);
              },
              onPlay: async () => {
                if (applyingRemoteRef.current) return;
                lastLocalActionAtRef.current = Date.now();
                manualStartRef.current = true;
                setManualStart(true);
                diag("player.onPlay");
                await push("play", { playbackState: "playing" });
              },
              onPause: async () => {
                if (applyingRemoteRef.current) return;
                lastLocalActionAtRef.current = Date.now();
                diag("player.onPause");
                const t = playerRef.current?.getCurrentTime() ?? currentTime;
                await push("pause", { playbackState: "paused", currentTime: t });
              },
              onBuffering: () => diag("player.onBuffering"),
              onCued: () => diag("player.onCued"),
              onStatusChange: (s) => { playerStatusRef.current = s; },
              onEnded: async () => {
                lastLocalActionAtRef.current = Date.now();
                await push("ended", { playbackState: "paused" });
              },
              onError: (msg) => setError(msg),
              onProgress: (t, d) => {
                setCurrentTime(t);
                setDuration(d);
              },
            }}
          />

          {/* Info + controles */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2a2a31] bg-[#16161a] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{videoTitle || videoId || "Nenhum vídeo carregado"}</p>
              <p className="text-xs tabular-nums text-zinc-400">
                {formatTime(currentTime)} / {formatTime(duration)} · {state?.playback_state ?? "idle"}
              </p>
            </div>
            {!manualStart && videoId && (
              <button
                onClick={() => {
                  manualStartRef.current = true;
                  setManualStart(true);
                  // eslint-disable-next-line no-console
                  console.log("[YT] PLAY_REQUESTED", videoId);
                  playerRef.current?.play();
                  push("play", { playbackState: "playing" });
                }}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900"
              >
                Iniciar reprodução
              </button>
            )}
          </div>

          <QueuePanel queue={queue} currentVideoId={videoId} onSelect={handleSelectQueue} onRemove={handleRemoveQueue} error={queueError} />
        </div>

        <div className={activeTab === "video" ? "hidden md:flex md:min-h-0" : "flex min-h-0"}>
          <ChatPanel messages={messages} meName={data?.me.participant_name ?? null} onSend={handleSendMessage} error={chatError} />
        </div>
      </div>

      <footer className="safe-bottom pb-2 text-center text-[11px] text-zinc-600">
        Sincronização via estado compartilhado · Atualize a página sem perder a sala
      </footer>
    </div>
  );
}
