import { describe, it, expect } from "vitest";
import { mapYouTubeError } from "@/lib/youtube-player";

describe("mapYouTubeError", () => {
  it("mapeia códigos conhecidos", () => {
    expect(mapYouTubeError(2)).toMatch(/rejeitou/);
    expect(mapYouTubeError(5)).toMatch(/HTML5/);
    expect(mapYouTubeError(100)).toMatch(/não encontrado|privado/);
    expect(mapYouTubeError(101)).toMatch(/não permite incorporação/);
    expect(mapYouTubeError(150)).toMatch(/não permite incorporação/);
    expect(mapYouTubeError(126)).toMatch(/não suportado/);
    expect(mapYouTubeError(-11)).toMatch(/indisponível/);
    expect(mapYouTubeError(0)).toMatch(/Erro/);
    expect(mapYouTubeError(999)).toMatch(/Erro/);
  });

  it("para 101/150, mensagem é acionável", () => {
    const msg = mapYouTubeError(150);
    expect(msg.toLowerCase()).not.toBe("erro genérico");
    expect(msg).toMatch(/Escolha outro vídeo|não pode ser reproduzido/);
  });
});
