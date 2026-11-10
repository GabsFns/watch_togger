import { describe, it, expect, vi } from "vitest";
import { sanitizeName, sanitizeMessage } from "@/lib/security";

describe("sanitize", () => {
  it("trim e limita nome", () => {
    expect(sanitizeName("  Ana   Maria  ")).toBe("Ana Maria");
    expect(sanitizeName("")).toBe("");
    expect(sanitizeName("a".repeat(100)).length).toBeLessThanOrEqual(40);
  });

  it("remove tags HTML de mensagens", () => {
    expect(sanitizeMessage("<b>oi</b>")).toBe("oi");
    expect(sanitizeMessage("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("limita mensagem em 500 chars", () => {
    expect(sanitizeMessage("x".repeat(2000)).length).toBeLessThanOrEqual(500);
  });
});
