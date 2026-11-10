"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeAPI, YT_STATES, mapYouTubeError, type YouTubePlayerHandle } from "@/lib/youtube-player";

export type PlayerStatus =
  | "EMPTY"
  | "LOADING_API"
  | "LOADING_VIDEO"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "BUFFERING"
  | "ERROR"
  | "ENDED";

export interface VideoPlayerEvents {
  onReady: () => void;
  onPlay: () => void;
  onPause: () => void;
  onBuffering: () => void;
  onEnded: () => void;
  onCued: () => void;
  onError: (msg: string) => void;
  onStatusChange: (s: PlayerStatus) => void;
  onProgress: (currentTime: number, duration: number) => void;
}

export interface VideoPlayerHandle {
  cueVideo: (videoId: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  ready: boolean;
  getStatus: () => PlayerStatus;
}

const DIV_ID = "yt-player-div";

// Cópia direta do padrão da página /debug/player: cria o YT.Player direto
// no useEffect, sem wrapper, sem createdRef, sem applyRemoteState.
// O RoomView controla tudo pelo handleRef + eventos.
export function VideoPlayer({ videoId: videoIdProp, events, handleRef }: { videoId: string | null; events: VideoPlayerEvents; handleRef: React.RefObject<VideoPlayerHandle | null> }) {
  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const [status, setStatus] = useState<PlayerStatus>("LOADING_API");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const statusRef = useRef<PlayerStatus>("LOADING_API");
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setStatusSafe(s: PlayerStatus) {
    statusRef.current = s;
    setStatus((prev) => (prev === s ? prev : s));
    eventsRef.current.onStatusChange?.(s);
  }

  function clearLoadTimeout() {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }

  function startLoadTimeout() {
    clearLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      const s = statusRef.current;
      if (s === "LOADING_API" || s === "LOADING_VIDEO") {
        const msg = "O YouTube está demorando para responder. Verifique sua internet e tente novamente.";
        setErrorMsg(msg);
        setStatusSafe("ERROR");
        eventsRef.current.onError(msg);
      }
    }, 20000);
  }

  useEffect(() => {
    let cancelled = false;

    setStatusSafe("LOADING_API");
    startLoadTimeout();
    // eslint-disable-next-line no-console
    console.log("[YT] API_LOADING");

    loadYouTubeAPI()
      .then((YT: any) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.log("[YT] PLAYER_CREATING", DIV_ID);
        // eslint-disable-next-line no-console
        console.log("[YT] API_READY", `YT=${!!window.YT} Player=${!!window.YT?.Player}`);
        const el = document.getElementById(DIV_ID);
        if (!el) {
          console.log("[YT] PLAYER_ERROR elemento não encontrado");
          return;
        }
        const player = new YT.Player(DIV_ID, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            fs: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              clearLoadTimeout();
              setInitialized(true);
              setStatusSafe("READY");
              eventsRef.current.onReady();
              startProgressLoop();
              // eslint-disable-next-line no-console
              console.log("[YT] PLAYER_READY");
            },
            onStateChange: (e: any) => {
              const data = e?.data;
              // eslint-disable-next-line no-console
              console.log("[YT] STATE_CHANGED", data);
              if (data === YT_STATES.PLAYING) {
                clearLoadTimeout();
                setStatusSafe("PLAYING");
                eventsRef.current.onPlay();
              } else if (data === YT_STATES.PAUSED) {
                setStatusSafe("PAUSED");
                eventsRef.current.onPause();
              } else if (data === YT_STATES.BUFFERING) {
                setStatusSafe("BUFFERING");
                eventsRef.current.onBuffering();
              } else if (data === YT_STATES.ENDED) {
                setStatusSafe("ENDED");
                eventsRef.current.onEnded();
              } else if (data === YT_STATES.CUED) {
                clearLoadTimeout();
                setStatusSafe("WAITING_FOR_USER" as PlayerStatus);
                eventsRef.current.onCued();
                // eslint-disable-next-line no-console
                console.log("[YT] VIDEO_CUED");
              } else if (data === YT_STATES.UNSTARTED) {
                setStatusSafe("READY");
              }
            },
            onError: (e: any) => {
              clearLoadTimeout();
              // eslint-disable-next-line no-console
              console.log("[YT] PLAYER_ERROR", e?.data);
              const msg = mapYouTubeError(Number(e?.data ?? 0));
              setErrorMsg(msg);
              setStatusSafe("ERROR");
              eventsRef.current.onError(msg);
            },
          },
        });
        playerRef.current = player;
      })
      .catch((err) => {
        clearLoadTimeout();
        const msg = "Não foi possível carregar o player do YouTube.";
        setErrorMsg(msg);
        setStatusSafe("ERROR");
        eventsRef.current.onError(msg);
        // eslint-disable-next-line no-console
        console.log("[YT] PLAYER_ERROR api:", err?.message);
      });

    function startProgressLoop() {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
          const t = typeof p.getCurrentTime === "function" ? p.getCurrentTime() : 0;
          const d = typeof p.getDuration === "function" ? p.getDuration() : 0;
          eventsRef.current.onProgress(Number(t) || 0, Number(d) || 0);
        } catch {}
      }, 500);
    }

    return () => {
      cancelled = true;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      clearLoadTimeout();
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando o videoId muda, faz cue direto — igual ao debug.
  useEffect(() => {
    if (!initialized) return;
    if (!videoIdProp) {
      setStatusSafe("EMPTY");
      return;
    }
    const p = playerRef.current;
    if (!p) {
      setStatusSafe("LOADING_VIDEO");
      startLoadTimeout();
      return;
    }
    setErrorMsg(null);
    setStatusSafe("LOADING_VIDEO");
    startLoadTimeout();
    try {
      p.cueVideoById(videoIdProp);
    } catch {
      try { p.loadVideoById(videoIdProp); } catch {}
    }
  }, [videoIdProp, initialized]);

  handleRef.current = {
    cueVideo: (id: string) => {
      const p = playerRef.current;
      if (!p) return;
      setErrorMsg(null);
      setStatusSafe("LOADING_VIDEO");
      startLoadTimeout();
      try {
        p.cueVideoById(id);
      } catch {
        try { p.loadVideoById(id); } catch {}
      }
    },
    play: () => {
      // eslint-disable-next-line no-console
      console.log("[YT] PLAY_REQUESTED");
      try {
        if (!playerRef.current) return;
        playerRef.current.playVideo();
      } catch {}
    },
    pause: () => { try { playerRef.current?.pauseVideo(); } catch {} },
    seekTo: (sec: number) => { try { playerRef.current?.seekTo(sec, true); } catch {} },
    getCurrentTime: () => {
      try { return Number(playerRef.current?.getCurrentTime() ?? 0); } catch { return 0; }
    },
    getDuration: () => {
      try { return Number(playerRef.current?.getDuration() ?? 0); } catch { return 0; }
    },
    ready: initialized,
    getStatus: () => statusRef.current,
  };

  return (
    <div className="video-shell relative overflow-hidden rounded-2xl border border-[#2a2a31] bg-black">
      <div id={DIV_ID} className="h-full w-full" />

      {status === "EMPTY" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
          <p className="text-base font-medium text-zinc-100">Nenhum vídeo selecionado</p>
          <p className="max-w-sm text-sm text-zinc-400">Cole um link do YouTube no campo acima para começar.</p>
        </div>
      )}

      {(status === "LOADING_API" || status === "LOADING_VIDEO" || status === "BUFFERING") && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-zinc-100">
            {status === "LOADING_API" && "Carregando player…"}
            {status === "BUFFERING" && "Carregando conteúdo…"}
            {status === "LOADING_VIDEO" && "Preparando vídeo…"}
          </span>
        </div>
      )}

      {status === "PLAYING" && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-zinc-100">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Reproduzindo
        </div>
      )}

      {status === "PAUSED" && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-zinc-300">
          <span className="h-2 w-2 rounded-full bg-zinc-400" />
          Pausado
        </div>
      )}

      {status === "ERROR" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center">
          <p className="text-sm font-medium text-zinc-100">Erro no player</p>
          <p className="max-w-sm text-xs leading-relaxed text-zinc-400">{errorMsg ?? "Algo saiu do esperado."}</p>
          <button
            onClick={() => {
              const p = playerRef.current;
              if (!p) return;
              setErrorMsg(null);
              setStatusSafe("LOADING_VIDEO");
              startLoadTimeout();
              try { p.cueVideoById(videoIdProp ?? ""); } catch {
                try { p.loadVideoById(videoIdProp ?? ""); } catch {}
              }
            }}
            className="rounded-xl bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-900"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
