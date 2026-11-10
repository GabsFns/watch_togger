import { describe, it, expect } from "vitest";
import { extractYouTubeVideoId, parseYouTubeUrl, isValidVideoId, formatTime } from "@/lib/youtube";

describe("extractYouTubeVideoId", () => {
  it("extrai de watch?v=", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extrai de youtu.be", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
  });
  it("extrai de shorts", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/abc123XYZ-_")).toBe("abc123XYZ-_");
  });
  it("extrai de embed e live (formato oficial)", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extrai com timestamp t= e NÃO inclui na ID", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=AWb-Y9nXZkE&t=3616s")).toBe("AWb-Y9nXZkE");
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/AWb-Y9nXZkE")).toBe("AWb-Y9nXZkE");
    expect(extractYouTubeVideoId("https://youtu.be/AWb-Y9nXZkE?t=1h2m3s")).toBe("AWb-Y9nXZkE");
  });
  it("aceita ID puro", () => {
    expect(extractYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("rejeita URLs inválidas", () => {
    expect(extractYouTubeVideoId("https://google.com")).toBeNull();
    expect(extractYouTubeVideoId("")).toBeNull();
    expect(extractYouTubeVideoId("https://youtube.com/watch")).toBeNull();
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=AWb-Y9nXZkE&t=3616s extra")).toBe("AWb-Y9nXZkE");
  });
});

describe("parseYouTubeUrl timestamp", () => {
  it("preserva t=3616s", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=AWb-Y9nXZkE&t=3616s")).toEqual({ videoId: "AWb-Y9nXZkE", startSeconds: 3616 });
    expect(parseYouTubeUrl("https://youtu.be/AWb-Y9nXZkE?t=42")).toEqual({ videoId: "AWb-Y9nXZkE", startSeconds: 42 });
  });
  it("suporta 1h2m3s e start= embed", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s")?.startSeconds).toBe(3723);
    expect(parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ?start=30")?.startSeconds).toBe(30);
  });
  it("sem t => null", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/embed/AWb-Y9nXZkE")).toEqual({ videoId: "AWb-Y9nXZkE", startSeconds: null });
  });
});

describe("isValidVideoId", () => {
  it("valida IDs típicos", () => {
    expect(isValidVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isValidVideoId("abc-123_")).toBe(true);
    expect(isValidVideoId("ab")).toBe(false);
    expect(isValidVideoId("id com espaço")).toBe(false);
  });
});

describe("formatTime", () => {
  it("formata tempos", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(-5)).toBe("0:00");
  });
});
