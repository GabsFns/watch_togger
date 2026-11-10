"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeAPI, YT_STATES, mapYouTubeError, type YouTubePlayerHandle } from "@/lib/youtube-player";
import { parseYouTubeUrl } from "@/lib/youtube";

const KNOWN_VIDEOS = [
  { id: "AWb-Y9nXZkE", label: "Informado (AWb-Y9nXZkE)" },
  { id: "dQw4w9WgXcQ", label: "Referência (dQw4w9WgXcQ)" },
];

interface LogEntry {
  at: string;
  tag: string;
  detail?: string;
}

export default function DebugPlayerPage() {
  const startedAtRef = useRef(0);
  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [playerCreated, setPlayerCreated] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [videoId, setVideoId] = useState(KNOWN_VIDEOS[0].id);
  const [numericState, setNumericState] = useState<number | null>(null);
  const [visual, setVisual] = useState("—");
  const [lastEvent, setLastEvent] = useState("—");
  const [lastError, setLastError] = useState("—");
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [customId, setCustomId] = useState("");

  function log(tag: string, detail?: string) {
    const t = new Date().toISOString().slice(11, 23);
    const msg = `[YT] ${tag}${detail ? " " + detail : ""}`;
    // eslint-disable-next-line no-console
    console.log(msg);
    setLogs((prev) => [{ at: t, tag, detail }, ...prev].slice(0, 80));
  }

  useEffect(() => {
    startedAtRef.current = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - startedAtRef.current) / 1000), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    log("API_LOADING");
    loadYouTubeAPI()
      .then((YT: any) => {
        if (cancelled) return;
        setApiLoaded(true);
        log("API_READY", `YT=${!!window.YT} Player=${!!window.YT?.Player}`);
        log("PLAYER_CREATING");
        // Cria player só depois da API pronta; sem videoId inicial (cue manual)
        const player = new YT.Player("debug-yt-div", {
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
              setPlayerCreated(true);
              setPlayerReady(true);
              playerRef.current = e.target as YouTubePlayerHandle;
              const s = e.target?.getPlayerState?.() ?? null;
              if (typeof s === "number") setNumericState(s);
              setVisual("READY");
              setLastEvent("onReady");
              log("PLAYER_READY", `state=${s}`);
            },
            onStateChange: (e: any) => {
              const data = e?.data as number;
              setNumericState(data);
              const names: Record<number, string> = {
                [YT_STATES.UNSTARTED]: "UNSTARTED",
                [YT_STATES.ENDED]: "ENDED",
                [YT_STATES.PLAYING]: "PLAYING",
                [YT_STATES.PAUSED]: "PAUSED",
                [YT_STATES.BUFFERING]: "BUFFERING",
                [YT_STATES.CUED]: "CUED",
              };
              const name = names[data] ?? `UNKNOWN(${data})`;
              setLastEvent(`onStateChange=${name}`);
              setVisual(name);
              log("STATE_CHANGED", name);
              if (data === YT_STATES.CUED) log("VIDEO_CUED", videoId);
            },
            onError: (e: any) => {
              const code = Number(e?.data ?? 0);
              const msg = mapYouTubeError(code);
              setLastError(`${code} — ${msg}`);
              setLastEvent("onError");
              setVisual("ERROR");
              log("PLAYER_ERROR", `${code} ${msg}`);
            },
          },
        });
        void player;
      })
      .catch((err) => {
        log("PLAYER_ERROR", `api: ${err?.message}`);
      });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cue(raw: string) {
    const parsed = parseYouTubeUrl(raw);
    if (!parsed) {
      log("PLAYER_ERROR", `parse falhou: ${raw}`);
      return;
    }
    const p = playerRef.current;
    if (!p) {
      log("PLAYER_ERROR", "player não pronto");
      return;
    }
    setVideoId(parsed.videoId);
    setLastError("—");
    setVisual("LOADING_VIDEO");
    log("VIDEO_CUED", `${parsed.videoId} start=${parsed.startSeconds ?? 0}`);
    try {
      // Player recebe SOMENTE o videoId (string pura), nunca URL.
      p.cueVideoById(parsed.videoId);
      if (parsed.startSeconds != null && parsed.startSeconds > 0) {
        // Timestamp inicial preservado apenas na carga local.
        // A sincronização posterior da sala usa room_state, não este valor.
        const t = setTimeout(() => {
          try { p.seekTo(parsed.startSeconds!, true); } catch {}
          clearTimeout(t);
        }, 800);
      }
    } catch (e: any) {
      log("PLAYER_ERROR", e?.message);
    }
  }

  function play() {
    const p = playerRef.current;
    if (!p) return;
    log("PLAY_REQUESTED", videoId);
    try { p.playVideo(); } catch (e: any) { log("PLAYER_ERROR", e?.message); }
  }

  function pause() {
    const p = playerRef.current;
    if (!p) return;
    try { p.pauseVideo(); } catch {}
  }

  function seek() {
    const p = playerRef.current;
    if (!p) return;
    try { p.seekTo(30, true); } catch {}
  }

  const rows: Array<[string, string]> = [
    ["API carregada", apiLoaded ? "SIM" : "NÃO"],
    ["Player criado", playerCreated ? "SIM" : "NÃO"],
    ["Player pronto", playerReady ? "SIM" : "NÃO"],
    ["Video ID atual", videoId],
    ["Estado numérico", numericState === null ? "—" : String(numericState)],
    ["Estado visual", visual],
    ["Último evento", lastEvent],
    ["Último erro", lastError],
    ["Tempo de carregamento", `${elapsed.toFixed(1)}s`],
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-bold">Debug — YouTube Player isolado</h1>
        <p className="text-sm text-zinc-400">Sem Supabase, sem Realtime, sem sala. Apenas YT API.</p>
      </header>

      <div className="video-shell relative overflow-hidden rounded-2xl border border-[#2a2a31] bg-black">
        <div id="debug-yt-div" className="h-full w-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        {KNOWN_VIDEOS.map((v) => (
          <button key={v.id} onClick={() => cue(v.id)} className="rounded-xl border border-[#2a2a31] px-3 py-2 text-xs text-zinc-200">
            {v.label}
          </button>
        ))}
        <input
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
          placeholder="URL completa ou videoId"
          className="h-9 flex-1 rounded-xl border border-[#2a2a31] bg-[#16161a] px-3 text-xs"
        />
        <button onClick={() => customId.trim() && cue(customId.trim())} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900">
          Carregar custom
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={play} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900">Reproduzir</button>
        <button onClick={pause} className="rounded-xl border border-[#2a2a31] px-4 py-2 text-sm text-zinc-200">Pausar</button>
        <button onClick={seek} className="rounded-xl border border-[#2a2a31] px-4 py-2 text-sm text-zinc-200">Seek 30s</button>
      </div>

      <div className="rounded-2xl border border-[#2a2a31] bg-[#16161a] p-4">
        <h2 className="mb-2 text-sm font-semibold">Painel</h2>
        <dl className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-[#0e0e10] px-3 py-2">
              <dt className="text-zinc-500">{k}</dt>
              <dd className="mt-1 font-mono text-zinc-100 break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-[#2a2a31] bg-black p-4">
        <h2 className="mb-2 text-sm font-semibold">Eventos</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-300">
          {logs.map((l, i) => (
            <div key={i} className="border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">{l.at}</span> [YT] {l.tag} {l.detail ?? ""}
            </div>
          ))}
          {logs.length === 0 && <p className="text-zinc-500">Nenhum evento ainda…</p>}
        </div>
      </div>
    </div>
  );
}
