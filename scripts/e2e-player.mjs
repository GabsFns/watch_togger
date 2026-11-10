import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";

function readEnv() {
  const raw = fs.readFileSync(".env", "utf8");
  const env = {};
  raw.split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
  return env;
}

function log(tag, msg) {
  console.log(`[${new Date().toISOString().slice(11, 23)}] ${tag} ${msg}`);
}

async function run() {
  const env = readEnv();
  const code = env.ROOM_ACCESS_CODE;
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  let sawPlayerReady = false;
  let sawPlayRequested = false;
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[YT]")) {
      log("CONSOLE", `${msg.type()} ${text}`);
      if (text.includes("PLAYER_READY")) sawPlayerReady = true;
      if (text.includes("PLAY_REQUESTED")) sawPlayRequested = true;
    }
    if ((text.includes("error") || text.includes("Error") || text.includes("Failed")) && !text.includes("postMessage")) {
      log("CONSOLE", `${msg.type()} ${text}`);
    }
  });
  page.on("pageerror", (err) => log("PAGEERROR", err.message));

  log("TEST", "open /");
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

  const nameInput = page.locator("input").first();
  await nameInput.click({ force: true });
  await nameInput.fill("AuditE2E");
  const codeInput = page.locator("input").nth(1);
  await codeInput.fill(code ?? "");
  await page.locator('button:has-text("Entrar")').first().click();
  await page.waitForURL("**/room", { timeout: 15000 }).catch(() => log("WARN", "não redirecionou para /room"));
  log("TEST", "url=" + page.url());
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const roomId = env.NEXT_PUBLIC_ROOM_ID;
  await sb.from("room_state").update({ current_video_id: "AWb-Y9nXZkE", playback_state: "paused", current_time_seconds: 0, updated_by: "AuditE2E", action_id: "e2e-1", last_action: "load_video" }).eq("room_id", roomId);
  log("DB", "set video AWb-Y9nXZkE paused");

  await page.waitForTimeout(8000);
  log("TEST", "reloading /room");
  await page.goto(BASE + "/room", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(12000);

  const preText = await page.locator("body").innerText();
  log("PRE", preText.slice(0, 400).replace(/\n/g, " | "));
  const ytState = await page.evaluate(() => ({
    yt: !!window.YT,
    player: !!window.YT?.Player,
    div: !!document.getElementById("yt-player-div"),
    iframeInDiv: !!document.querySelector("#yt-player-div iframe"),
  })).catch((e) => ({ err: e.message }));
  log("YT_STATE", JSON.stringify(ytState));

  const prep = page.locator('button:has-text("Preparar reprodução")');
  if ((await prep.count()) > 0) {
    log("TEST", "clicking Preparar reprodução");
    await prep.first().click({ force: true });
    await page.waitForTimeout(4000);
  }

  const playBtn = page.locator('button:has-text("Iniciar reprodução")');
  if ((await playBtn.count()) > 0) {
    log("TEST", "clicking Iniciar reprodução");
    await playBtn.first().click({ force: true });
    await page.waitForTimeout(10000);
  }

  const finalText = await page.locator("body").innerText();
  log("FINAL", finalText.slice(0, 600).replace(/\n/g, " | "));
  const frames = page.frames().map((f) => f.url());
  log("FINAL", `page frames=${frames.length} ${JSON.stringify(frames.slice(0, 4))}`);
  const iframeCount = await page.locator("iframe").count();
  log("FINAL", `iframes=${iframeCount}`);
  if (iframeCount > 0) {
    const src = await page.locator("iframe").first().getAttribute("src").catch(() => "no-src");
    log("FINAL", `iframe src=${(src ?? "").slice(0, 200)}`);
  }

  const playing = finalText.toLowerCase().includes("reproduzindo") || finalText.toLowerCase().includes("playing");
  log("RESULT", sawPlayerReady ? "PLAYER_READY recebido (ok)" : "PLAYER_READY NÃO recebido");
  log("RESULT", sawPlayRequested ? "PLAY_REQUESTED enviado" : "PLAY_REQUESTED não enviado");
  log("RESULT", playing ? "DOM mostra playing (ok)" : "DOM NÃO mostra playing");
  log("RESULT", (sawPlayerReady && playing) ? "SUCESSO: vídeo rodando" : "FALHA: verifique logs acima");

  // cleanup
  await sb.from('room_participants').delete().eq('room_id', roomId);
  await sb.from('room_state').update({ current_video_id: null, playback_state: 'idle', current_time_seconds: 0, updated_by: null, action_id: null, last_action: 'init' }).eq('room_id', roomId);
  log("DB", "cleanup ok");

  await browser.close();
}

run().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
