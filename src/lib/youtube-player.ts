// YouTube IFrame Player API — wrapper Safari-safe.
// Nunca deixa a Promise de API pendente: se o script já está no DOM,
// aguarda onYouTubeIframeAPIReady; se YT já existe, resolve imediatamente.

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;
let apiLoaded = false;
let apiError: Error | null = null;

export function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.YT?.Player) {
    apiLoaded = true;
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;
  if (apiError) return Promise.reject(apiError);

  apiPromise = new Promise((resolve, reject) => {
    const settle = () => {
      apiLoaded = true;
      resolve(window.YT);
    };

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { if (prev) prev(); } catch {}
      settle();
    };

    // Se YT já está totalmente carregado (script de sessão anterior), resolve já.
    if (window.YT?.Player) {
      settle();
      return;
    }

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => {
        apiError = new Error("Erro ao carregar YouTube API");
        apiPromise = null;
        reject(apiError);
      };
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(tag, first);
    }
    // Se já existe, o handler onYouTubeIframeAPIReady acima será chamado pelo YouTube
    // quando o Player ficar disponível, resolvendo a promise.
  });
  return apiPromise;
}

export const YT_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YouTubePlayerHandle {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate?: () => number;
  mute: () => void;
  unMute: () => void;
  setVolume: (v: number) => void;
  getVolume?: () => number;
  isMuted?: () => boolean;
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  getVideoData: () => { video_id: string; title: string } | any;
  getIframe?: () => HTMLIFrameElement;
  destroy: () => void;
}

export interface CreatePlayerOptions {
  videoId?: string;
  width?: string;
  height?: string;
  onReady?: (e: any) => void;
  onStateChange?: (e: any) => void;
  onError?: (e: any) => void;
  origin?: string;
}

export async function createYouTubePlayer(
  elementId: string,
  opts: CreatePlayerOptions
): Promise<YouTubePlayerHandle> {
  const YT = await loadYouTubeAPI();
  // eslint-disable-next-line no-console
  console.log("[YT] PLAYER_CREATING", elementId);
  return new Promise((resolve) => {
    const playerVars: Record<string, any> = {
      autoplay: 0,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      enablejsapi: 1,
      fs: 1,
      iv_load_policy: 3,
      origin: opts.origin ?? window.location.origin,
    };
    // Garante origin válido (http(s)://host). Em localhost o YouTube aceita.
    if (!/^https?:\/\/.+/.test(playerVars.origin)) {
      delete playerVars.origin;
    }

    const player = new YT.Player(elementId, {
      width: opts.width ?? "100%",
      height: opts.height ?? "100%",
      videoId: opts.videoId,
      playerVars,
      events: {
        onReady: (e: any) => {
          // eslint-disable-next-line no-console
          console.log("[YT] PLAYER_READY videoId=" + (opts.videoId ?? "none"));
          resolve(e.target as YouTubePlayerHandle);
          opts.onReady?.(e);
        },
        onStateChange: opts.onStateChange,
        onError: opts.onError,
      },
    });
    void player;
  });
}

export function mapYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return "O YouTube rejeitou o parâmetro enviado (2). Confira o link e tente novamente.";
    case 5:
      return "O player encontrou um erro de reprodução HTML5 (5). Recarregue a página e tente outro vídeo.";
    case 100:
      return "Vídeo não encontrado ou privado (100). Ele não pode ser exibido na sala.";
    case 101:
    case 150:
      return "Este vídeo não permite incorporação e não pode ser reproduzido na sala (101/150). Escolha outro vídeo.";
    case 126:
      return "Dispositivo não suportado para este vídeo (126).";
    case -11:
      return "Vídeo indisponível no momento (-11).";
    default:
      return `Erro ao reproduzir o vídeo (${code || "desconhecido"}). Tente novamente em instantes.`;
  }
}
