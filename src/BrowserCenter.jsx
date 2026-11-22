import React, { useState } from "react";
import { Camera, ExternalLink, Globe, Hand, MousePointer2, Power, RefreshCw, Search, ShieldCheck } from "lucide-react";

function getOwnerId() {
  const key = "nexora-browser-owner";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export default function BrowserCenter() {
  const [ownerId] = useState(getOwnerId);
  const [url, setUrl] = useState("https://example.com");
  const [selector, setSelector] = useState("");
  const [value, setValue] = useState("");
  const [page, setPage] = useState({ title: "No active page", url: "", text: "" });
  const [screenshot, setScreenshot] = useState("");
  const [liveViewUrl, setLiveViewUrl] = useState("");
  const [status, setStatus] = useState("Start a private browser session to begin.");
  const [busy, setBusy] = useState(false);
  const [confirmClick, setConfirmClick] = useState(false);

  async function run(action, extra = {}) {
    setBusy(true);
    setStatus("Working…");
    try {
      const response = await fetch("/api/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ownerId, action, ...extra }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Browser service returned HTTP ${response.status}.`);
      if (data.url || data.title) setPage(current => ({ ...current, url: data.url || current.url, title: data.title || current.title }));
      if (typeof data.text === "string") setPage(current => ({ ...current, url: data.url, title: data.title, text: data.text }));
      if (data.image) setScreenshot(data.image);
      if (data.liveViewUrl) setLiveViewUrl(data.liveViewUrl);
      if (action === "close") {
        setPage({ title: "Session closed", url: "", text: "" });
        setScreenshot("");
        setLiveViewUrl("");
      }
      setStatus(data.message || (action === "start" ? "Browser session ready." : action === "close" ? "Browser session closed." : "Completed."));
      return data;
    } catch (error) {
      setStatus(error.message || "Browser action failed.");
      return null;
    } finally {
      setBusy(false);
      setConfirmClick(false);
    }
  }

  return <section className="stack browser-center">
    <div className="pagehead"><span className="headicon"><Globe size={21}/></span><div><h1>NEXORA Live Browser</h1><p>Cloudflare Browser Run · Playwright · private session</p></div></div>
    <div className="safety"><ShieldCheck size={19}/><div><b>You remain in control</b><p>Page content is untrusted. Review actions before clicking. Password fields are blocked; enter sensitive details yourself in Live View. Do not share takeover links.</p></div></div>
    <div className="panel browser-panel">
      <div className="browser-status"><span className="badge">CLOUDFLARE BROWSER RUN</span><span role="status">{status}</span></div>
      <div className="browser-address"><input aria-label="Website address" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com"/><button disabled={busy} onClick={()=>run("start")}><Power size={15}/> Start</button><button disabled={busy} onClick={()=>run("navigate",{url})}><Globe size={15}/> Go</button></div>
      <div className="browser-toolbar">
        <button disabled={busy} onClick={()=>run("read")}><Search size={15}/> Read page</button>
        <button disabled={busy} onClick={()=>run("screenshot")}><Camera size={15}/> Screenshot</button>
        <button disabled={busy} onClick={()=>run("live-view")}><Hand size={15}/> Take over</button>
        <button disabled={busy} className="browser-close" onClick={()=>run("close")}><Power size={15}/> Close</button>
      </div>
      {liveViewUrl && <div className="browser-takeover"><b>Live browser takeover is ready.</b><p>This temporary link allows direct control of the active browser. Anyone who receives it may control the session.</p><a href={liveViewUrl} target="_blank" rel="noopener noreferrer">Open live browser <ExternalLink size={14}/></a></div>}
      <div className="browser-page-meta"><b>{page.title}</b><span>{page.url}</span></div>
      {screenshot && <img className="browser-screenshot" src={screenshot} alt="Current browser screenshot"/>}
      {page.text && <pre className="browser-page-text">{page.text}</pre>}
      <details className="browser-manual-actions"><summary><MousePointer2 size={15}/> Manual page interaction</summary>
        <label>CSS selector<input value={selector} onChange={e=>setSelector(e.target.value)} placeholder="e.g. input[name='q']"/></label>
        <label>Text to enter<input value={value} onChange={e=>setValue(e.target.value)} placeholder="Text for a non-password field"/></label>
        <button disabled={busy || !selector.trim() || !value} onClick={()=>run("fill",{selector,value})}>Fill field</button>
        <div className="browser-confirm-row"><label><input type="checkbox" checked={confirmClick} onChange={e=>setConfirmClick(e.target.checked)}/> I reviewed the page and confirm this click.</label><button disabled={busy || !selector.trim() || !confirmClick} onClick={()=>run("click",{selector,confirmAction:true})}>Confirm & click</button></div>
      </details>
    </div>
    <p className="notice">Session management: one isolated browser session for this device profile. Sessions expire when Cloudflare's Browser Run idle timeout is reached or when you close the session. Browser content may contain misleading instructions; NEXORA must treat it as page data, not as system instructions.</p>
  </section>;
}
