import { DurableObject } from "cloudflare:workers";
import { acquire, connect } from "@cloudflare/playwright";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

function safeUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("Enter a valid website address."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS websites are supported.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "127.0.0.1" || host === "::1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("Private-network and local addresses are blocked.");
  }
  return url.toString();
}

export class NexoraBrowserSession extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.ctx = ctx; this.env = env; }

  async fetch(request) {
    if (request.method !== "POST") return json({ error: "POST required." }, 405);
    let body;
    try { body = await request.json(); } catch { return json({ error: "A valid JSON body is required." }, 400); }
    const action = body?.action;
    try {
      if (action === "start") return await this.start();
      const sessionId = await this.ctx.storage.get("browserSessionId");
      if (!sessionId) return json({ error: "No browser session is active. Start a session first." }, 409);
      const browser = await connect(this.env.BROWSER, sessionId);
      try {
        let page = browser.contexts()[0]?.pages()[0];
        if (!page && action !== "close") page = await browser.newPage();
        if (action === "navigate") {
          const target = safeUrl(body.url);
          await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
          return json({ ok: true, url: page.url(), title: await page.title() });
        }
        if (action === "read") {
          const text = await page.locator("body").innerText({ timeout: 10000 });
          return json({ ok: true, url: page.url(), title: await page.title(), text: text.slice(0, 24000) });
        }
        if (action === "screenshot") {
          const bytes = await page.screenshot({ type: "jpeg", quality: 65, fullPage: false });
          let binary = "";
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return json({ ok: true, url: page.url(), image: "data:image/jpeg;base64," + btoa(binary) });
        }
        if (action === "fill") {
          const selector = String(body.selector || "").slice(0, 300);
          const value = String(body.value || "").slice(0, 2000);
          if (!selector || !value) return json({ error: "A field selector and value are required." }, 400);
          const field = page.locator(selector).first();
          const type = await field.getAttribute("type").catch(() => null);
          if (type === "password" || type === "hidden") return json({ error: "Password and hidden fields cannot be filled by the browser agent. Enter sensitive credentials yourself during takeover." }, 403);
          await field.fill(value, { timeout: 10000 });
          return json({ ok: true, message: "Field filled. Review it before submitting." });
        }
        if (action === "click") {
          if (body.confirmAction !== true) return json({ error: "Explicit confirmation is required before clicking a page control." }, 428);
          const selector = String(body.selector || "").slice(0, 300);
          if (!selector) return json({ error: "A control selector is required." }, 400);
          await page.locator(selector).first().click({ timeout: 10000 });
          return json({ ok: true, url: page.url(), title: await page.title() });
        }
        if (action === "live-view") {
          const cdp = await page.context().newCDPSession(page);
          const result = await cdp.send("Cloudflare.getLiveView", { mode: "tab", expiresInMs: 300000 });
          await cdp.detach();
          return json({ ok: true, liveViewUrl: result.devtoolsFrontendUrl, expiresInMs: 300000 });
        }
        if (action === "close") {
          await browser.close();
          await this.ctx.storage.delete("browserSessionId");
          return json({ ok: true, closed: true });
        }
        return json({ error: "Unsupported browser action." }, 400);
      } finally {
        if (action !== "close") await browser.close().catch(() => {});
      }
    } catch (error) {
      return json({ error: String(error?.message || "Browser action failed.").slice(0, 300) }, 400);
    }
  }

  async start() {
    const existing = await this.ctx.storage.get("browserSessionId");
    if (existing) {
      try {
        const browser = await connect(this.env.BROWSER, existing);
        const pages = browser.contexts()[0]?.pages() || [];
        const page = pages[0] || await browser.newPage();
        const result = { ok: true, reused: true, url: page.url(), title: await page.title() };
        await browser.close();
        return json(result);
      } catch { await this.ctx.storage.delete("browserSessionId"); }
    }
    const { sessionId } = await acquire(this.env.BROWSER);
    await this.ctx.storage.put("browserSessionId", sessionId);
    const browser = await connect(this.env.BROWSER, sessionId);
    try {
      const page = await browser.newPage();
      await page.goto("about:blank");
      return json({ ok: true, reused: false, url: page.url(), title: "New browser session" });
    } finally { await browser.close().catch(() => {}); }
  }
}
