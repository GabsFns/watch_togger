const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;

export function isValidVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id);
}

export interface ParsedYouTubeUrl {
  videoId: string;
  startSeconds: number | null;
}

/**
 * Extrai videoId + start (t=) de URLs do YouTube:
 * - https://www.youtube.com/watch?v=ID&t=3616s
 * - https://youtu.be/ID?t=42
 * - https://www.youtube.com/shorts/ID
 * - https://www.youtube.com/embed/ID?start=30
 * - https://www.youtube.com/live/ID
 * - ID puro (opcional)
 *
 * O timestamp é retornado separadamente — nunca faz parte do videoId.
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  if (!input) return null;
  const trimmed = input.trim();

  // ID puro (sem URL): aceita, sem timestamp
  if (isValidVideoId(trimmed) && !trimmed.includes("/") && !trimmed.includes("?") && !trimmed.includes("&")) {
    return { videoId: trimmed, startSeconds: null };
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();

    let videoId: string | null = null;

    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      const seg = url.pathname.split("/").filter(Boolean)[0];
      if (seg && isValidVideoId(seg)) videoId = seg;
    } else if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    ) {
      const v = url.searchParams.get("v");
      if (v && isValidVideoId(v)) videoId = v;
      if (!videoId) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const kind = parts[0].toLowerCase();
          if (["shorts", "embed", "live", "v"].includes(kind)) {
            const seg = parts[1];
            if (seg && isValidVideoId(seg)) videoId = seg;
          }
        }
      }
    }

    if (!videoId) return null;

    return { videoId, startSeconds: parseStartParam(url) };
  } catch {
    return null;
  }
}

function parseStartParam(url: URL): number | null {
  // t=3616s / t=3616 / t=1h2m3s | start=30 (embed)
  const raw = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (!raw) return null;
  const val = raw.trim();
  // HH:MM:SS ou MM:SS
  if (val.includes(":")) {
    const parts = val.split(":").map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  // 1h2m3s
  const m = val.match(/^\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?\s*$/i);
  if (m) {
    const h = Number(m[1] ?? 0);
    const min = Number(m[2] ?? 0);
    const s = Number(m[3] ?? 0);
    if (Number.isFinite(h + min + s)) return h * 3600 + min * 60 + s;
  }
  const n = Number(val.replace(/s$/i, ""));
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return null;
}

export function extractYouTubeVideoId(input: string): string | null {
  return parseYouTubeUrl(input)?.videoId ?? null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
