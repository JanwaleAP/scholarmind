import { useState, useEffect, useRef } from "react";

// ── STORAGE ──
const getUsers = () => { try { return JSON.parse(localStorage.getItem("sm_users_v3") || "{}"); } catch { return {}; } };
const setUsers = (u) => localStorage.setItem("sm_users_v3", JSON.stringify(u));
const getSession = () => { try { return JSON.parse(localStorage.getItem("sm_sess_v3") || "null"); } catch { return null; } };
const setSession = (s) => localStorage.setItem("sm_sess_v3", JSON.stringify(s));
const clearSession = () => localStorage.removeItem("sm_sess_v3");
const getHist = (email) => { try { return JSON.parse(localStorage.getItem("sm_h_" + btoa(email)) || "[]"); } catch { return []; } };
const setHist = (email, h) => localStorage.setItem("sm_h_" + btoa(email), JSON.stringify(h));

// ── CLAUDE API ──
async function claude(prompt, system, onChunk) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      stream: false,
      system: system || SYS,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error?.message || "API error " + r.status);
  }
  const data = await r.json();
  const text = data.content?.[0]?.text || "";
  if (onChunk) onChunk(text);
  return text;
}

const SYS = `You are ScholarMind, a world-class AI research assistant for academics, researchers, and PhD students.
Provide detailed, structured, academically rigorous responses. Use ## for headings, - for bullets, **bold** for emphasis.
Include representative citations (Author et al., Year). Note limitations and future directions.
You support all Indian languages — if the user writes in Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi, Punjabi, or any other Indian language, respond in that same language while maintaining academic quality.`;

// ── UTILS ──
const initials = (n) => (n || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

function fmtText(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (/^#{1,3} /.test(line)) return <div key={i} style={{ fontFamily: "'Fraunces',serif", fontSize: 16, color: "#0f1f3d", margin: "1rem 0 .4rem", fontWeight: 700, borderBottom: "1px solid #e7e0d8", paddingBottom: 4 }}>{line.replace(/^#+\s/, "")}</div>;
    if (/^[-•] /.test(line)) return <div key={i} style={{ paddingLeft: 16, marginBottom: 2 }}>• {fmtInline(line.replace(/^[-•]\s/, ""))}</div>;
    if (/^\d+\.\s/.test(line)) return <div key={i} style={{ paddingLeft: 16, marginBottom: 2 }}>{fmtInline(line)}</div>;
    if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
    return <div key={i} style={{ marginBottom: 2 }}>{fmtInline(line)}</div>;
  });
}
function fmtInline(text) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ color: "#0f1f3d" }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} style={{ background: "#f1f0ee", padding: "1px 5px", borderRadius: 4, fontSize: 13 }}>{p.slice(1, -1)}</code>;
    return p;
  });
}

const TOOL_ICONS = { synthesis: "🔍", gaps: "🧠", draft: "✍️", qa: "❓", citation: "📎", abstract: "📄", formatter: "📐", generator: "🚀", reviewer: "🔬", paraphrase: "✨", stats: "📊", ethics: "⚖️" };
const TOOL_NAMES = { synthesis: "Literature Synthesis", gaps: "Gap Finder", draft: "Draft Generator", qa: "Research Q&A", citation: "Citations", abstract: "Abstract", formatter: "Format Converter", generator: "Article Generator", reviewer: "Peer Review Simulator", paraphrase: "Humanizer & Anti-Detect", stats: "Stats Explainer", ethics: "Ethics Checker" };

// ── STYLES ──
const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,300&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{font-family:'DM Sans',sans-serif;background:#fdf8f0;color:#0f1f3d;overflow-x:hidden;}
:root{
  --navy:#0f1f3d;--n2:#1a3260;--teal:#0e7490;--tl:#06b6d4;
  --amber:#d97706;--al:#fbbf24;--cream:#fdf8f0;--cd:#f3ece0;
  --border:#e7e0d8;--err:#dc2626;--ok:#16a34a;
  --sh:0 4px 16px rgba(15,31,61,.1);--shL:0 12px 40px rgba(15,31,61,.14);
}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .18s;outline:none;white-space:nowrap;}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;}
.btn-p{background:var(--navy);color:#fff;} .btn-p:hover:not(:disabled){background:var(--n2);transform:translateY(-1px);}
.btn-t{background:var(--teal);color:#fff;} .btn-t:hover:not(:disabled){background:#0c6578;transform:translateY(-1px);}
.btn-o{background:transparent;color:var(--navy);border:1.5px solid var(--navy);} .btn-o:hover:not(:disabled){background:var(--navy);color:#fff;}
.btn-g{background:transparent;color:#44403c;} .btn-g:hover:not(:disabled){background:rgba(15,31,61,.06);color:var(--navy);}
.btn-r{background:#fee2e2;color:var(--err);border:none;} .btn-r:hover{background:#fca5a5;}
.btn-sm{padding:7px 14px;font-size:13px;border-radius:8px;}
.btn-lg{padding:13px 30px;font-size:15px;border-radius:12px;}
.btn-w{width:100%;justify-content:center;}
.btn-white{background:#fff;color:var(--navy);font-weight:600;} .btn-white:hover{background:var(--cd);}
.btn-amber{background:linear-gradient(135deg,var(--amber),var(--al));color:#fff;}
.btn-amber:hover:not(:disabled){opacity:.9;transform:translateY(-1px);}

/* NAV */
.nav{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(253,248,240,.96);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);}
.nav-in{max-width:1280px;margin:0 auto;padding:0 1.5rem;height:62px;display:flex;align-items:center;justify-content:space-between;gap:1rem;}
.logo{display:flex;align-items:center;gap:10px;cursor:pointer;}
.logo-mark{width:33px;height:33px;background:linear-gradient(135deg,var(--navy),var(--teal));border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Fraunces',serif;font-weight:600;font-size:16px;}
.logo-text{font-family:'Fraunces',serif;font-weight:600;font-size:19px;color:var(--navy);}
.logo-text span{color:var(--teal);}
.nav-links{display:flex;align-items:center;gap:2px;list-style:none;}
.nl{padding:7px 13px;border-radius:8px;color:#44403c;font-size:14px;font-weight:500;cursor:pointer;transition:all .18s;}
.nl:hover,.nl.on{color:var(--navy);background:rgba(15,31,61,.07);font-weight:600;}
.nav-acts{display:flex;align-items:center;gap:8px;}
.upill{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:100px;padding:4px 13px 4px 4px;cursor:pointer;position:relative;}
.uav{width:27px;height:27px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--teal));display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;}
.uname{font-size:13px;font-weight:500;color:var(--navy);}
.drop{position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:var(--shL);padding:6px;min-width:150px;z-index:300;}
.di{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;font-size:14px;cursor:pointer;transition:background .15s;color:#44403c;}
.di:hover{background:var(--cd);}

/* LAYOUT */
.app-wrap{display:flex;min-height:calc(100vh - 62px);margin-top:62px;}
.sidebar{width:240px;flex-shrink:0;background:#fff;border-right:1px solid var(--border);padding:1rem .6rem;display:flex;flex-direction:column;height:calc(100vh - 62px);position:sticky;top:62px;overflow-y:auto;}
.sb-sec{padding:0 10px;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#78716c;margin:1rem 0 4px;}
.sb-item{display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:9px;color:#44403c;font-size:13.5px;font-weight:500;cursor:pointer;transition:all .16s;}
.sb-item:hover{background:var(--cd);color:var(--navy);}
.sb-item.on{background:rgba(14,116,144,.1);color:var(--teal);font-weight:600;}
.sb-icon{font-size:15px;width:17px;text-align:center;flex-shrink:0;}
.sb-new{font-size:9px;font-weight:700;letter-spacing:.4px;background:linear-gradient(90deg,var(--amber),var(--al));color:#fff;padding:1px 6px;border-radius:100px;margin-left:auto;}
.main{flex:1;padding:1.75rem;overflow-y:auto;height:calc(100vh - 62px);}

/* LANDING */
.land{max-width:1200px;margin:0 auto;padding:0 1.5rem;}
.hero{padding:90px 0 70px;display:grid;grid-template-columns:1fr 1fr;gap:3.5rem;align-items:center;}
.hbadge{display:inline-flex;align-items:center;gap:8px;background:rgba(14,116,144,.08);border:1px solid rgba(14,116,144,.2);color:var(--teal);padding:5px 14px;border-radius:100px;font-size:12px;font-weight:600;margin-bottom:1.1rem;}
.pulse{width:6px;height:6px;background:var(--tl);border-radius:50%;animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
.hero h1{font-family:'Fraunces',serif;font-size:clamp(2rem,3.8vw,3.2rem);font-weight:600;line-height:1.15;color:var(--navy);letter-spacing:-.4px;margin-bottom:1.1rem;}
.hero h1 em{font-style:italic;color:var(--teal);}
.hdesc{font-size:16px;color:#44403c;line-height:1.7;margin-bottom:1.75rem;max-width:450px;}
.hbtns{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:2.25rem;}
.avs{display:flex;}
.asm{width:29px;height:29px;border-radius:50%;border:2px solid var(--cream);margin-left:-6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;}
.asm:first-child{margin-left:0;}
.proof{display:flex;align-items:center;gap:9px;font-size:13px;color:#78716c;}
.hvis{position:relative;}
.dcard{background:#fff;border-radius:16px;box-shadow:var(--shL),0 0 0 1px var(--border);overflow:hidden;animation:flt 6s ease-in-out infinite;}
@keyframes flt{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.dtop{background:var(--navy);padding:11px 16px;display:flex;align-items:center;gap:9px;}
.ddots{display:flex;gap:5px;}
.ddot{width:8px;height:8px;border-radius:50%;}
.dbody{padding:14px;display:flex;flex-direction:column;gap:11px;}
.msr{background:var(--cd);border:1px solid var(--border);border-radius:7px;padding:9px 13px;font-size:11px;color:#78716c;display:flex;align-items:center;gap:7px;}
.mstats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}
.mst{background:var(--cd);border:1px solid var(--border);border-radius:7px;padding:9px;}
.mstv{font-family:'Fraunces',serif;font-size:19px;font-weight:600;color:var(--navy);}
.mstl{font-size:9px;color:#78716c;margin-top:1px;}
.mpap{background:var(--cd);border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:6px;padding:7px 11px;display:flex;align-items:center;justify-content:space-between;}
.mpt{font-size:10px;color:#44403c;font-weight:500;}
.mpg{font-size:9px;background:rgba(14,116,144,.1);color:var(--teal);padding:2px 7px;border-radius:100px;font-weight:600;}
.mai{background:linear-gradient(135deg,rgba(15,31,61,.03),rgba(14,116,144,.04));border:1px solid rgba(14,116,144,.12);border-radius:7px;padding:11px;}
.mal{font-size:9px;font-weight:700;color:var(--teal);letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;}
.maln{display:flex;flex-direction:column;gap:5px;}
.maline{height:6px;background:var(--border);border-radius:3px;animation:shim 2.5s infinite;}
@keyframes shim{0%,100%{opacity:.5;}50%{opacity:1;}}
.fbadge{position:absolute;background:#fff;border-radius:9px;box-shadow:var(--sh);padding:7px 11px;border:1px solid var(--border);font-size:11px;font-weight:600;display:flex;align-items:center;gap:7px;white-space:nowrap;}

/* SECTIONS */
.sec{padding:70px 0;}
.slabel{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--teal);margin-bottom:8px;}
.stitle{font-family:'Fraunces',serif;font-size:clamp(1.7rem,2.8vw,2.4rem);font-weight:600;color:var(--navy);letter-spacing:-.3px;line-height:1.2;margin-bottom:.7rem;}
.sdesc{font-size:15px;color:#44403c;max-width:500px;line-height:1.7;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem;margin-top:2.5rem;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;}
.fc{background:#fff;border:1px solid var(--border);border-radius:14px;padding:1.5rem;transition:all .22s;}
.fc:hover{transform:translateY(-3px);box-shadow:var(--shL);border-color:rgba(14,116,144,.15);}
.fi{width:42px;height:42px;border-radius:10px;background:rgba(14,116,144,.08);display:flex;align-items:center;justify-content:center;font-size:19px;margin-bottom:.85rem;}
.fc h3{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:var(--navy);margin-bottom:.4rem;}
.fc p{font-size:13px;color:#78716c;line-height:1.6;}
.new-tag{font-size:9px;font-weight:700;background:linear-gradient(90deg,var(--amber),var(--al));color:#fff;padding:2px 7px;border-radius:100px;margin-left:8px;vertical-align:middle;}
.logos-bar{border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:#fff;padding:28px 0;}
.logos-label{text-align:center;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#78716c;margin-bottom:20px;}
.logos-row{display:flex;align-items:center;justify-content:center;gap:2.5rem;flex-wrap:wrap;}
.luni{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:#d6d3d1;}
.pcw{max-width:420px;margin:0 auto;}
.pcard{background:var(--navy);border-radius:18px;padding:2rem;color:#fff;}
.pname{font-family:'Fraunces',serif;font-size:21px;font-weight:600;margin-bottom:.3rem;}
.pdesc{font-size:13px;color:rgba(255,255,255,.6);margin-bottom:1.1rem;}
.pamt{display:flex;align-items:baseline;gap:3px;margin-bottom:1.25rem;}
.pcur{font-size:17px;color:rgba(255,255,255,.7);}
.pnum{font-family:'Fraunces',serif;font-size:44px;font-weight:600;line-height:1;}
.pper{font-size:13px;color:rgba(255,255,255,.5);}
.pdiv{height:1px;background:rgba(255,255,255,.12);margin-bottom:1.1rem;}
.pfl{list-style:none;display:flex;flex-direction:column;gap:8px;margin-bottom:1.5rem;}
.pfl li{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.82);}
.pfl li::before{content:"✓";width:16px;height:16px;min-width:16px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--al);}
.tc{background:var(--cd);border:1px solid var(--border);border-radius:14px;padding:1.5rem;}
.stars{color:var(--amber);font-size:13px;letter-spacing:2px;margin-bottom:.65rem;}
.ttxt{font-size:13px;color:#44403c;line-height:1.7;margin-bottom:1.1rem;font-style:italic;}
.tauth{display:flex;align-items:center;gap:9px;}
.tav{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;font-family:'Fraunces',serif;}
.taname{font-weight:600;font-size:13px;}
.tarole{font-size:11px;color:#78716c;}
.ctabox{background:linear-gradient(135deg,var(--navy),var(--n2),#0a4a6e);border-radius:18px;padding:60px 44px;text-align:center;margin-bottom:70px;}
.ctabox h2{font-family:'Fraunces',serif;font-size:clamp(1.5rem,2.3vw,2.2rem);color:#fff;margin-bottom:.7rem;}
.ctabox p{color:rgba(255,255,255,.7);font-size:15px;margin-bottom:1.75rem;max-width:400px;margin-left:auto;margin-right:auto;}
.cbtns{display:flex;gap:10px;justify-content:center;}
.footer{background:var(--navy);color:rgba(255,255,255,.6);padding:44px 0 22px;}
.fg2{display:grid;grid-template-columns:2fr 1fr 1fr;gap:2.5rem;margin-bottom:2.25rem;}
.fbrand p{font-size:13px;color:rgba(255,255,255,.45);margin-top:9px;line-height:1.7;max-width:210px;}
.fcol h5{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:10px;}
.flinks{list-style:none;display:flex;flex-direction:column;gap:7px;}
.flinks li{font-size:13px;color:rgba(255,255,255,.55);cursor:pointer;} .flinks li:hover{color:#fff;}
.fdiv{height:1px;background:rgba(255,255,255,.07);margin-bottom:1.25rem;}
.fbot{display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.3);}

/* AUTH */
.ov{position:fixed;inset:0;z-index:500;background:rgba(15,31,61,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;}
.modal{background:#fff;border-radius:17px;box-shadow:var(--shL);width:100%;max-width:430px;overflow:hidden;}
.mhd{padding:1.6rem 1.6rem 0;display:flex;align-items:center;justify-content:space-between;}
.mclose{background:none;border:none;cursor:pointer;color:#78716c;font-size:19px;line-height:1;padding:3px;}
.mclose:hover{color:var(--navy);}
.mbd{padding:1.1rem 1.6rem 1.6rem;}
.mtabs{display:flex;border-bottom:2px solid var(--border);margin-bottom:1.1rem;}
.mtab{flex:1;padding:8px;text-align:center;font-size:13.5px;font-weight:600;color:#78716c;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .18s;}
.mtab.on{color:var(--navy);border-bottom-color:var(--navy);}
.mtitle{font-family:'Fraunces',serif;font-size:21px;font-weight:600;color:var(--navy);margin-bottom:.25rem;}
.msub{font-size:13px;color:#78716c;margin-bottom:1.1rem;}
.fgrp{margin-bottom:.9rem;}
.fgrp label{display:block;font-size:12px;font-weight:600;color:#44403c;margin-bottom:4px;}
.fgrp input{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:9px;font-size:14px;font-family:'DM Sans',sans-serif;color:var(--navy);background:var(--cd);transition:border-color .18s;}
.fgrp input:focus{outline:none;border-color:var(--teal);background:#fff;}
.anote{font-size:12px;color:#78716c;text-align:center;margin-top:.65rem;}
.anote span{color:var(--teal);cursor:pointer;font-weight:500;}

/* TOOLS */
.ptitle{font-family:'Fraunces',serif;font-size:25px;font-weight:600;color:var(--navy);margin-bottom:.25rem;}
.psub{font-size:13.5px;color:#78716c;margin-bottom:1.5rem;}
.tcard{background:#fff;border:1px solid var(--border);border-radius:15px;padding:1.6rem;margin-bottom:1.1rem;}
.tcardtitle{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:var(--navy);margin-bottom:.9rem;display:flex;align-items:center;gap:8px;}
textarea.ti,input.ti,select.ti{width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:9px;font-size:13.5px;font-family:'DM Sans',sans-serif;color:var(--navy);background:var(--cd);transition:border-color .18s;resize:vertical;}
textarea.ti{min-height:100px;}
textarea.ti:focus,input.ti:focus,select.ti:focus{outline:none;border-color:var(--teal);background:#fff;}
select.ti{resize:none;cursor:pointer;}
.tacts{display:flex;gap:8px;margin-top:.9rem;flex-wrap:wrap;}
.rbox{background:var(--cd);border:1px solid var(--border);border-radius:12px;padding:1.4rem;margin-top:1.1rem;font-size:14px;color:#44403c;line-height:1.8;word-break:break-word;}
.rmeta{display:flex;align-items:center;justify-content:space-between;margin-top:.9rem;padding-top:.9rem;border-top:1px solid var(--border);}
.rminfo{font-size:11px;color:#78716c;}
.cursor{display:inline-block;width:2px;height:14px;background:var(--teal);margin-left:2px;animation:blink .7s infinite;vertical-align:middle;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
.spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:sp .6s linear infinite;}
@keyframes sp{to{transform:rotate(360deg);}}
.flabel{font-size:12px;font-weight:600;color:#44403c;display:block;margin-bottom:4px;}
.chkrow{display:flex;flex-wrap:wrap;gap:10px;margin-top:.4rem;}
.chki{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;}
.upload-area{border:2px dashed var(--border);border-radius:12px;padding:2rem;text-align:center;cursor:pointer;transition:all .2s;background:var(--cd);}
.upload-area:hover,.upload-area.drag{border-color:var(--teal);background:rgba(14,116,144,.04);}
.upload-icon{font-size:32px;margin-bottom:.5rem;}
.upload-text{font-size:14px;color:#44403c;font-weight:500;}
.upload-sub{font-size:12px;color:#78716c;margin-top:4px;}
.file-chip{display:inline-flex;align-items:center;gap:8px;background:rgba(14,116,144,.08);border:1px solid rgba(14,116,144,.2);color:var(--teal);padding:6px 12px;border-radius:8px;font-size:13px;font-weight:500;margin-top:.75rem;}
.badge-new{font-size:9px;font-weight:700;background:linear-gradient(90deg,var(--amber),var(--al));color:#fff;padding:1px 7px;border-radius:100px;vertical-align:middle;margin-left:6px;}
.info-box{background:rgba(14,116,144,.06);border:1px solid rgba(14,116,144,.18);border-radius:10px;padding:.85rem 1rem;font-size:13px;color:var(--teal);margin-bottom:1rem;display:flex;gap:8px;align-items:flex-start;}
.warn-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:.85rem 1rem;font-size:13px;color:#92400e;margin-bottom:1rem;display:flex;gap:8px;align-items:flex-start;}
.lang-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1rem;}
.lang-chip{padding:4px 12px;border-radius:100px;border:1px solid var(--border);font-size:12px;cursor:pointer;transition:all .15s;background:#fff;color:#44403c;}
.lang-chip.on{background:var(--navy);color:#fff;border-color:var(--navy);}

/* DASHBOARD */
.stats4{display:grid;grid-template-columns:repeat(4,1fr);gap:.9rem;margin-bottom:1.5rem;}
.sc{background:#fff;border:1px solid var(--border);border-radius:11px;padding:1rem;}
.sci{font-size:19px;margin-bottom:.3rem;}
.scv{font-family:'Fraunces',serif;font-size:24px;font-weight:600;color:var(--navy);}
.scl{font-size:12px;color:#78716c;margin-top:2px;}
.qg{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-bottom:1.5rem;}
.rc{background:#fff;border:1px solid var(--border);border-radius:11px;padding:1.1rem;}
.rt{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:var(--navy);margin-bottom:.9rem;}
.ai{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);}
.ai:last-child{border-bottom:none;}
.aic{width:32px;height:32px;border-radius:8px;background:var(--cd);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.aib{flex:1;}
.ait{font-size:13px;font-weight:500;color:var(--navy);}
.aid{font-size:11px;color:#78716c;}
.aitag{font-size:11px;color:var(--teal);font-weight:600;white-space:nowrap;}

/* HISTORY */
.hc{background:#fff;border:1px solid var(--border);border-radius:11px;padding:1rem 1.2rem;cursor:pointer;transition:all .16s;margin-bottom:.65rem;}
.hc:hover{box-shadow:var(--sh);border-color:rgba(14,116,144,.2);}
.hchd{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;}
.hct{font-weight:600;font-size:13.5px;color:var(--navy);flex:1;}
.hctool{font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:2px 9px;border-radius:100px;background:rgba(14,116,144,.08);color:var(--teal);}
.hcprev{font-size:12px;color:#78716c;margin-top:5px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.hcdate{font-size:11px;color:#78716c;margin-top:5px;}
.hcacts{display:flex;gap:5px;margin-top:7px;}

/* DETAIL MODAL */
.dmod{background:#fff;border-radius:17px;box-shadow:var(--shL);width:100%;max-width:720px;max-height:88vh;overflow-y:auto;}
.dmhd{padding:1.2rem 1.6rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1;}
.dmbd{padding:1.6rem;}
.dlbl{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#78716c;margin-bottom:.5rem;}
.dq{background:var(--cd);border-radius:9px;padding:.8rem 1rem;font-size:13.5px;color:#44403c;margin-bottom:1.1rem;}

/* PROFILE */
.profav{width:66px;height:66px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--teal));display:flex;align-items:center;justify-content:center;color:#fff;font-size:25px;font-weight:700;font-family:'Fraunces',serif;}
.bfree{font-size:11px;background:rgba(14,116,144,.08);color:var(--teal);border:1px solid rgba(14,116,144,.2);border-radius:100px;padding:2px 10px;display:inline-block;margin-top:5px;font-weight:600;}
.empty{text-align:center;padding:3rem 2rem;color:#78716c;}
.empi{font-size:40px;margin-bottom:.65rem;opacity:.5;}
.empty h3{font-family:'Fraunces',serif;font-size:18px;color:#44403c;margin-bottom:.35rem;}

@media(max-width:900px){.hero{grid-template-columns:1fr;}.hvis{display:none;}.g3{grid-template-columns:1fr 1fr;}.stats4{grid-template-columns:1fr 1fr;}.qg{grid-template-columns:1fr 1fr;}.sidebar{display:none;}.fg2{grid-template-columns:1fr;}}
@media(max-width:600px){.g3{grid-template-columns:1fr;}.stats4{grid-template-columns:1fr 1fr;}.qg{grid-template-columns:1fr;}.g2{grid-template-columns:1fr;}.cbtns{flex-direction:column;align-items:center;}.fbot{flex-direction:column;gap:5px;}}
`;

// ── INDIAN LANGUAGES ──
const LANGS = [
  { code: "en", label: "English" }, { code: "hi", label: "हिंदी" }, { code: "bn", label: "বাংলা" },
  { code: "te", label: "తెలుగు" }, { code: "mr", label: "मराठी" }, { code: "ta", label: "தமிழ்" },
  { code: "gu", label: "ગુજરાતી" }, { code: "kn", label: "ಕನ್ನಡ" }, { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" }, { code: "or", label: "ଓଡ଼ିଆ" }, { code: "as", label: "অসমীয়া" },
];

// ── TOOL RESULT COMPONENT ──
function ResultBox({ result, loading, time, onCopy, onDownload }) {
  if (!result && !loading) return null;
  return (
    <div>
      <div className="rbox">
        {loading && !result && <span style={{ color: "#78716c", fontStyle: "italic" }}>⚡ AI is generating your response…</span>}
        {result && fmtText(result)}
        {loading && <span className="cursor" />}
      </div>
      {!loading && time && (
        <div className="rmeta">
          <span className="rminfo">{time}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-g btn-sm" onClick={onCopy}>📋 Copy</button>
            <button className="btn btn-g btn-sm" onClick={onDownload}>⬇ Download</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TOOL HOOK ──
function useTool() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState("");

  async function run(prompt, system, saveEntry) {
    setLoading(true); setResult(""); setTime("");
    const start = Date.now();
    try {
      let full = "";
      await claude(prompt, system || SYS, (acc) => { full = acc; setResult(acc); });
      const el = ((Date.now() - start) / 1000).toFixed(1);
      const wc = full.split(/\s+/).filter(Boolean).length;
      setTime(`Generated in ${el}s · ${wc} words`);
      if (saveEntry) saveEntry(full);
    } catch (err) {
      setResult("⚠ Error: " + err.message + "\n\nPlease check your connection and try again.");
    }
    setLoading(false);
  }
  return { result, loading, time, run, setResult };
}

// ── MAIN APP ──
export default function ScholarMind() {
  const [view, setView] = useState("landing");
  const [authModal, setAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState(""); const [loginPass, setLoginPass] = useState(""); const [loginErr, setLoginErr] = useState("");
  const [signupName, setSignupName] = useState(""); const [signupEmail, setSignupEmail] = useState(""); const [signupPass, setSignupPass] = useState(""); const [signupErr, setSignupErr] = useState("");
  const [page, setPage] = useState("dashboard");
  const [userDrop, setUserDrop] = useState(false);
  const [history, setHistory] = useState([]);
  const [histSearch, setHistSearch] = useState(""); const [histFilter, setHistFilter] = useState("");
  const [detailEntry, setDetailEntry] = useState(null);
  const [selLang, setSelLang] = useState("en");

  // Restore session
  useEffect(() => {
    const sess = getSession();
    if (sess?.email) {
      const u = getUsers()[sess.email];
      if (u) { const cu = { email: sess.email, name: u.name }; setCurrentUser(cu); setHistory(getHist(sess.email)); setView("app"); setPage("dashboard"); }
    }
  }, []);

  function saveHistEntry(entry) {
    if (!currentUser) return;
    const h = [entry, ...getHist(currentUser.email)].slice(0, 500);
    setHist(currentUser.email, h); setHistory(h);
  }

  function openAuth(tab) { setAuthTab(tab); setLoginErr(""); setSignupErr(""); setLoginEmail(""); setLoginPass(""); setSignupName(""); setSignupEmail(""); setSignupPass(""); setAuthModal(true); }
  function closeAuth() { setAuthModal(false); }

  function doLogin() {
    setLoginErr("");
    if (!loginEmail.trim() || !loginPass) { setLoginErr("Please fill in all fields."); return; }
    const u = getUsers()[loginEmail.trim().toLowerCase()];
    if (!u) { setLoginErr("No account found."); return; }
    if (u.password !== btoa(loginPass)) { setLoginErr("Incorrect password."); return; }
    setAuthLoading(true);
    setTimeout(() => {
      const cu = { email: loginEmail.trim().toLowerCase(), name: u.name };
      setCurrentUser(cu); setSession(cu); setHistory(getHist(cu.email));
      setAuthLoading(false); setAuthModal(false); setView("app"); setPage("dashboard");
    }, 400);
  }

  function doSignup() {
    setSignupErr("");
    const name = signupName.trim(), email = signupEmail.trim().toLowerCase(), pass = signupPass;
    if (!name || !email || !pass) { setSignupErr("Please fill in all fields."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setSignupErr("Invalid email."); return; }
    if (pass.length < 6) { setSignupErr("Password must be 6+ characters."); return; }
    if (getUsers()[email]) { setSignupErr("Account already exists."); return; }
    setAuthLoading(true);
    setTimeout(() => {
      const ud = { name, email, password: btoa(pass), joined: new Date().toISOString() };
      setUsers({ ...getUsers(), [email]: ud });
      const cu = { email, name }; setCurrentUser(cu); setSession(cu); setHistory([]);
      setAuthLoading(false); setAuthModal(false); setView("app"); setPage("dashboard");
    }, 400);
  }

  function doLogout() { clearSession(); setCurrentUser(null); setHistory([]); setView("landing"); setUserDrop(false); }

  function navTo(p) { setPage(p); setUserDrop(false); }

  const counts = { synthesis: 0, gaps: 0, draft: 0, qa: 0, citation: 0, abstract: 0, formatter: 0, generator: 0, reviewer: 0, paraphrase: 0, stats: 0, ethics: 0 };
  history.forEach(h => { if (counts[h.tool] !== undefined) counts[h.tool]++; });

  const filteredHistory = history.filter(h => {
    if (histFilter && h.tool !== histFilter) return false;
    if (histSearch && !(h.title?.toLowerCase().includes(histSearch.toLowerCase()))) return false;
    return true;
  });

  const langSuffix = selLang !== "en" ? `\n\nIMPORTANT: Please respond entirely in ${LANGS.find(l => l.code === selLang)?.label || "English"} language while maintaining full academic quality and detail.` : "";

  // ── PAGES ──
  function ToolPage({ id, icon, title, sub, children }) {
    return (
      <div>
        <div className="ptitle">{icon} {title}</div>
        <div className="psub">{sub}</div>
        {children}
      </div>
    );
  }

  function CopyDownload({ text, name }) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-g btn-sm" onClick={() => navigator.clipboard?.writeText(text).catch(() => {})}>📋 Copy</button>
        <button className="btn btn-g btn-sm" onClick={() => { const b = new Blob([text], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = name + ".txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }}>⬇ Download</button>
      </div>
    );
  }

  // Tool: Format Converter
  function PageFormatter() {
    const [formatDesc, setFormatDesc] = useState("");
    const [articleText, setArticleText] = useState("");
    const [fileContent, setFileContent] = useState("");
    const [fileName, setFileName] = useState("");
    const { result, loading, time, run } = useTool();
    const fileRef = useRef();

    function handleFile(file) {
      if (!file) return;
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => setFileContent(e.target.result);
      reader.readAsText(file);
    }

    function doConvert() {
      const content = fileContent || articleText;
      if (!content.trim()) { alert("Please provide article content (paste text or upload file)."); return; }
      if (!formatDesc.trim()) { alert("Please describe the target format requirements."); return; }
      const prompt = `You are an expert academic formatter. Convert the following article/document to match the specified format requirements exactly.

TARGET FORMAT REQUIREMENTS:
${formatDesc}

ARTICLE CONTENT TO FORMAT:
${content}

Please:
1. Restructure the document exactly as the format specifies
2. Adjust headings, subheadings, section names to match the target format
3. Reformat citations and references to match the required style
4. Adjust abstract structure if specified
5. Add/remove sections as the format requires
6. Format tables, figures captions per the target format
7. Adjust font instructions (note them clearly as formatting notes)
8. Output the complete reformatted article

Start with a brief summary of changes made, then provide the fully reformatted document.${langSuffix}`;
      run(prompt, SYS, (full) => saveHistEntry({ id: Date.now().toString(), tool: "formatter", query: "Format conversion: " + fileName, result: full, date: new Date().toISOString(), title: "Format Converter: " + (fileName || formatDesc.slice(0, 40)) }));
    }

    return (
      <ToolPage id="formatter" icon="📐" title="Academic Format Converter" sub="Upload your article (Word/LaTeX/text) and provide the target format specifications — we'll reformat it completely.">
        <div className="info-box">ℹ️ Supports Word (.docx), LaTeX (.tex), plain text. Paste text directly or upload your file. Describe the target journal/conference format requirements.</div>
        <div className="tcard">
          <div className="tcardtitle">📄 Target Format Requirements</div>
          <textarea className="ti" value={formatDesc} onChange={e => setFormatDesc(e.target.value)} style={{ minHeight: 120 }}
            placeholder={"Describe the target format in detail. E.g.:\n- Journal: IEEE Transactions on Neural Networks\n- Sections: Abstract, Introduction, Related Work, Methodology, Experiments, Results, Discussion, Conclusion, References\n- Citation style: IEEE numbered [1]\n- Abstract: max 250 words, unstructured\n- Column layout: double-column\n- Heading styles: H1 bold caps, H2 bold, H3 italic\n\nOr paste the journal's author guidelines directly."} />
        </div>
        <div className="tcard">
          <div className="tcardtitle">📁 Article Content</div>
          <div className="upload-area" onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}>
            <div className="upload-icon">📎</div>
            <div className="upload-text">Drop your file here or click to browse</div>
            <div className="upload-sub">Supports .txt, .tex, .docx (as text), .md files</div>
            <input ref={fileRef} type="file" style={{ display: "none" }} accept=".txt,.tex,.md,.docx" onChange={e => handleFile(e.target.files[0])} />
            {fileName && <div className="file-chip">📄 {fileName} — loaded</div>}
          </div>
          <div style={{ textAlign: "center", margin: ".75rem 0", fontSize: 13, color: "#78716c" }}>— or paste text directly —</div>
          <textarea className="ti" value={articleText} onChange={e => setArticleText(e.target.value)} style={{ minHeight: 120 }}
            placeholder="Paste your article text here (LaTeX code, Word content copied as text, or plain text)..." />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={doConvert}>
              {loading ? <><span className="spin" /> Converting…</> : "📐 Convert Format"}
            </button>
            <button className="btn btn-g" onClick={() => { setArticleText(""); setFileContent(""); setFileName(""); }}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time}
          onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "formatted-article.txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} />
      </ToolPage>
    );
  }

  // Tool: Article Generator
  function PageGenerator() {
    const [rawData, setRawData] = useState("");
    const [dataType, setDataType] = useState("mixed");
    const [articleType, setArticleType] = useState("research_article");
    const [fieldName, setFieldName] = useState("");
    const [humanize, setHumanize] = useState(true);
    const { result, loading, time, run } = useTool();

    const dataTypes = { mixed: "Mixed (topic + data + code + output)", topic_only: "Topic/Idea only", code_output: "Code + Output/Results", raw_data: "Raw experimental data/numbers", methodology: "Methodology/Process description", literature: "Literature notes/summaries", experiment: "Experiment description + results" };
    const articleTypes = { research_article: "Full Research Article", review_paper: "Literature Review Paper", conference_paper: "Conference Paper", journal_article: "Journal Article", thesis_chapter: "Thesis Chapter", technical_report: "Technical Report", case_study: "Case Study" };

    function doGenerate() {
      if (!rawData.trim()) { alert("Please provide your raw data, topic, or content."); return; }
      const prompt = `You are an expert academic writer tasked with generating a complete, high-quality ${articleTypes[articleType]}.

FIELD/DOMAIN: ${fieldName || "General/As determined from content"}
RAW INPUT TYPE: ${dataTypes[dataType]}
RAW INPUT PROVIDED:
${rawData}

Generate a COMPLETE ${articleTypes[articleType]} with ALL standard sections. The article must be:

1. **COMPLETELY ORIGINAL** - Write every sentence freshly, never copying from training data
2. **HUMAN-LIKE WRITING** - Vary sentence length dramatically (short punchy sentences mixed with longer complex ones). Use natural transitions. Include occasional hedging phrases researchers naturally use.
3. **TURNITIN/AI-DETECTION SAFE** - 
   - Use varied, natural academic vocabulary (not repetitive formal phrases)
   - Mix active and passive voice naturally
   - Include field-specific jargon authentically
   - Use specific numbers, findings, and details from the provided data
   - Avoid overly uniform sentence structures
   - Write as a domain expert, not as an AI assistant
4. **ACADEMICALLY RIGOROUS** - Proper citations format, methodology, statistical language where applicable
5. **COMPLETE STRUCTURE**:

## Title
[Compelling, specific title]

## Abstract
[Structured abstract, ~250 words]

## Keywords
[6-8 relevant keywords]

## 1. Introduction
[Problem statement, motivation, gap, contributions, paper structure - 600-800 words]

## 2. Literature Review / Related Work
[Critical synthesis of prior work with citations like (Smith et al., 2020) - 500-700 words]

## 3. Methodology / Proposed Approach
[Detailed methodology derived from the raw data provided - 500-700 words]

## 4. Results and Analysis
[Specific results from the provided data/code/experiments - 400-600 words]

## 5. Discussion
[Interpretation, implications, limitations - 400-500 words]

## 6. Conclusion and Future Work
[Summary, contributions, future directions - 250-350 words]

## References
[10-15 representative references in APA format]

${humanize ? "CRITICAL: Make the writing feel genuinely human. Include natural academic imperfections like starting occasional sentences with 'However,' or 'Interestingly,', using contractions sparingly in discussion sections, and varying paragraph lengths significantly." : ""}${langSuffix}`;
      run(prompt, SYS, (full) => saveHistEntry({ id: Date.now().toString(), tool: "generator", query: rawData.slice(0, 100), result: full, date: new Date().toISOString(), title: "Article: " + (fieldName || rawData.slice(0, 50)) }));
    }

    return (
      <ToolPage id="generator" icon="🚀" title="Full Article Generator" sub="Provide ANY raw data — topic, code, results, methodology, or notes — and get a complete, publication-ready academic article.">
        <div className="warn-box">⚠️ <span>AI-generated text is a starting point. Always review, verify facts, add real citations, and refine before submission. Academic integrity is your responsibility.</span></div>
        <div className="tcard">
          <div className="tcardtitle">⚙️ Article Settings</div>
          <div className="g2">
            <div><label className="flabel">Article Type</label>
              <select className="ti" value={articleType} onChange={e => setArticleType(e.target.value)}>
                {Object.entries(articleTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="flabel">Research Field / Domain</label>
              <input className="ti" value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="E.g., Computer Science, Biotechnology, Economics..." />
            </div>
          </div>
          <div><label className="flabel">Raw Input Type</label>
            <select className="ti" value={dataType} onChange={e => setDataType(e.target.value)}>
              {Object.entries(dataTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="tcard">
          <div className="tcardtitle">📥 Your Raw Data / Content</div>
          <textarea className="ti" value={rawData} onChange={e => setRawData(e.target.value)} style={{ minHeight: 200 }}
            placeholder={"Paste ANYTHING here:\n\n• Just a topic: 'Impact of social media on student academic performance'\n\n• Code + output: def model()... → accuracy: 94.2%, F1: 0.91\n\n• Raw results: Group A mean=45.2±3.1, Group B mean=38.7±2.9, p=0.003\n\n• Methodology notes: 'Used survey of 200 students, 5-point Likert scale, analyzed with SPSS'\n\n• Multiple sources: mix of the above\n\nThe more detail you provide, the better and more accurate the article."} />
          <div style={{ marginTop: ".75rem" }}>
            <label className="chki">
              <input type="checkbox" checked={humanize} onChange={e => setHumanize(e.target.checked)} />
              <span style={{ fontSize: 13 }}>🛡️ Apply Human Writing Mode (reduces AI-detection, improves Turnitin safety)</span>
            </label>
          </div>
          <div className="tacts">
            <button className="btn btn-amber" disabled={loading} onClick={doGenerate}>
              {loading ? <><span className="spin" /> Generating Article…</> : "🚀 Generate Full Article"}
            </button>
            <button className="btn btn-g" onClick={() => setRawData("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time}
          onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "generated-article.txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} />
      </ToolPage>
    );
  }

  // Tool: Peer Review Simulator
  function PageReviewer() {
    const [artText, setArtText] = useState("");
    const [reviewType, setReviewType] = useState("full");
    const { result, loading, time, run } = useTool();
    return (
      <ToolPage id="reviewer" icon="🔬" title="Peer Review Simulator" sub="Get a realistic peer review of your manuscript — identify weaknesses before real submission.">
        <div className="tcard">
          <div className="tcardtitle">📋 Manuscript to Review</div>
          <div><label className="flabel">Review Type</label>
            <select className="ti" value={reviewType} onChange={e => setReviewType(e.target.value)} style={{ marginBottom: "1rem" }}>
              <option value="full">Full Peer Review (Major/Minor revisions)</option>
              <option value="quick">Quick Assessment (Accept/Reject probability)</option>
              <option value="methodology">Methodology-focused Review</option>
              <option value="statistics">Statistical Analysis Review</option>
              <option value="literature">Literature Coverage Review</option>
              <option value="writing">Writing Quality Review</option>
            </select>
          </div>
          <textarea className="ti" value={artText} onChange={e => setArtText(e.target.value)} style={{ minHeight: 150 }}
            placeholder="Paste your manuscript text, abstract, or specific sections for peer review simulation..." />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              if (!artText.trim()) { alert("Please paste your manuscript."); return; }
              run(`Simulate a rigorous peer review for this manuscript:\n\n${artText}\n\nProvide a ${reviewType} review with:\n## Overall Recommendation\n## Summary of Contribution\n## Major Concerns\n## Minor Concerns\n## Specific Comments by Section\n## Suggestions for Improvement\n## Verdict: Accept / Minor Revision / Major Revision / Reject (with probability estimate)${langSuffix}`, SYS, (f) => saveHistEntry({ id: Date.now().toString(), tool: "reviewer", query: artText.slice(0, 100), result: f, date: new Date().toISOString(), title: "Peer Review: " + artText.slice(0, 50) }));
            }}>
              {loading ? <><span className="spin" /> Reviewing…</> : "🔬 Simulate Peer Review"}
            </button>
            <button className="btn btn-g" onClick={() => setArtText("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "peer-review.txt"; document.body.appendChild(a); a.click(); }} />
      </ToolPage>
    );
  }

  // Tool: Humanizer / Anti-Detection
  function PageParaphrase() {
    const [input, setInput] = useState("");
    const [mode, setMode] = useState("humanize");
    const { result, loading, time, run } = useTool();
    const modes = { humanize: "Humanize (reduce AI detection)", turnitin: "Turnitin-safe paraphrase", simplify: "Simplify for clarity", elevate: "Elevate academic tone", shorten: "Condense while preserving meaning", expand: "Expand with more detail" };
    return (
      <ToolPage id="paraphrase" icon="✨" title="Humanizer & AI-Safe Rewriter" sub="Rewrite text to be human-like, reduce AI-detection risk, and pass Turnitin checks.">
        <div className="warn-box">⚠️ <span>This tool helps improve writing quality and natural expression. Always ensure the final content reflects your own understanding and research.</span></div>
        <div className="tcard">
          <div className="tcardtitle">✨ Rewriting Settings</div>
          <div><label className="flabel">Mode</label>
            <select className="ti" value={mode} onChange={e => setMode(e.target.value)} style={{ marginBottom: "1rem" }}>
              {Object.entries(modes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <textarea className="ti" value={input} onChange={e => setInput(e.target.value)} style={{ minHeight: 150 }}
            placeholder="Paste the text you want to rewrite. Works best on paragraphs of 100-500 words at a time." />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              if (!input.trim()) { alert("Please paste text to rewrite."); return; }
              const sysRewrite = mode === "humanize" || mode === "turnitin"
                ? `You are an expert academic writing coach who specializes in making AI-generated text indistinguishable from human writing. Your rewrites:
- Dramatically vary sentence length and structure
- Use natural academic idioms and field-specific expressions
- Mix active and passive voice organically
- Include occasional transitional phrases researchers naturally use
- Avoid robotic uniformity in phrasing
- Preserve all technical content and meaning exactly
- Make it sound like a thoughtful, experienced researcher wrote it` : SYS;
              run(`Rewrite the following text using the "${modes[mode]}" approach:\n\n${input}\n\nCritical requirements:\n- Preserve ALL technical facts, data, and meaning\n- Do NOT add fabricated information\n- Make the output feel authentically human-written\n- For Turnitin safety: restructure sentences significantly, use synonyms for common academic phrases, vary paragraph structure\n\nProvide ONLY the rewritten text, no explanations.${langSuffix}`, sysRewrite, (f) => saveHistEntry({ id: Date.now().toString(), tool: "paraphrase", query: input.slice(0, 100), result: f, date: new Date().toISOString(), title: "Humanize: " + input.slice(0, 50) }));
            }}>
              {loading ? <><span className="spin" /> Rewriting…</> : "✨ Rewrite Text"}
            </button>
            <button className="btn btn-g" onClick={() => setInput("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "rewritten.txt"; document.body.appendChild(a); a.click(); }} />
      </ToolPage>
    );
  }

  // Tool: Stats Explainer
  function PageStats() {
    const [input, setInput] = useState("");
    const [level, setLevel] = useState("explain");
    const { result, loading, time, run } = useTool();
    return (
      <ToolPage id="stats" icon="📊" title="Statistics Explainer & Advisor" sub="Describe your data or paste your statistical output — get plain-English explanations and advice.">
        <div className="tcard">
          <div className="tcardtitle">📊 Statistical Help Needed</div>
          <div><label className="flabel">What do you need?</label>
            <select className="ti" value={level} onChange={e => setLevel(e.target.value)} style={{ marginBottom: "1rem" }}>
              <option value="explain">Explain my statistical output in plain English</option>
              <option value="choose">Help me choose the right statistical test</option>
              <option value="interpret">Interpret my results for a paper</option>
              <option value="report">How to report this statistic in APA/journal format</option>
              <option value="sample">Calculate/advise on sample size</option>
              <option value="assumption">Check statistical assumptions</option>
              <option value="visualize">Suggest appropriate visualizations</option>
            </select>
          </div>
          <textarea className="ti" value={input} onChange={e => setInput(e.target.value)} style={{ minHeight: 130 }}
            placeholder={"Paste your statistical output, describe your data, or ask your question. Examples:\n\n• ANOVA: F(2,87)=4.23, p=.018, η²=.089 — what does this mean?\n• I have survey data from 150 participants with Likert scales — what test do I use?\n• My regression: R²=.34, β=.52, p<.001 — how do I write this up?\n• I want to compare means of 3 groups — which test?"} />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              if (!input.trim()) { alert("Please describe your statistical question."); return; }
              run(`You are a biostatistics and research methods expert. ${level === "explain" ? "Explain the following statistical output in plain English, covering what each value means, what it tells us, and how to interpret it for a research paper:" : level === "choose" ? "Help the researcher choose the right statistical test for their situation. Consider data type, distribution, number of groups, research question:" : level === "interpret" ? "Interpret these results in the context of a research paper. What story do the numbers tell? What conclusions can be drawn?" : level === "report" ? "Show exactly how to report this statistic in APA 7th edition format and common journal styles:" : level === "sample" ? "Advise on sample size calculation based on this description:" : level === "assumption" ? "Check and explain the statistical assumptions that need to be met and how to test them:" : "Suggest appropriate charts, graphs, and visualizations for this data:"}\n\n${input}\n\n## Plain English Explanation\n## Technical Interpretation\n## What This Means for Your Research\n## How to Write This in Your Paper\n## Limitations to Note${langSuffix}`, SYS, (f) => saveHistEntry({ id: Date.now().toString(), tool: "stats", query: input.slice(0, 100), result: f, date: new Date().toISOString(), title: "Stats: " + input.slice(0, 50) }));
            }}>
              {loading ? <><span className="spin" /> Analyzing…</> : "📊 Get Statistical Help"}
            </button>
            <button className="btn btn-g" onClick={() => setInput("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "stats-help.txt"; document.body.appendChild(a); a.click(); }} />
      </ToolPage>
    );
  }

  // Tool: Research Ethics Checker
  function PageEthics() {
    const [input, setInput] = useState("");
    const { result, loading, time, run } = useTool();
    return (
      <ToolPage id="ethics" icon="⚖️" title="Research Ethics Checker" sub="Describe your research design and get a thorough ethics review — IRB readiness, participant rights, data privacy.">
        <div className="tcard">
          <div className="tcardtitle">⚖️ Research Description</div>
          <textarea className="ti" value={input} onChange={e => setInput(e.target.value)} style={{ minHeight: 150 }}
            placeholder={"Describe your research:\n• What is the research about?\n• Who are the participants?\n• What data do you collect?\n• What methods do you use?\n• Any sensitive topics, vulnerable populations, or special considerations?\n\nE.g., 'Survey study on mental health of engineering students, collecting stress levels and academic performance data from 200 undergraduates, online anonymous questionnaire.'"} />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              if (!input.trim()) { alert("Please describe your research."); return; }
              run(`As a research ethics expert, provide a comprehensive ethics review for the following research:\n\n${input}\n\n## Ethics Overview\n## IRB/Ethics Committee Requirements\n## Informed Consent Requirements\n## Participant Rights and Protections\n## Data Privacy and Security Requirements\n## Potential Risks and Mitigation\n## Vulnerable Population Considerations\n## Data Storage and Retention Guidelines\n## Publication Ethics\n## Checklist: Ethics Approval Readiness\n## Recommended Next Steps${langSuffix}`, SYS, (f) => saveHistEntry({ id: Date.now().toString(), tool: "ethics", query: input.slice(0, 100), result: f, date: new Date().toISOString(), title: "Ethics Review: " + input.slice(0, 50) }));
            }}>
              {loading ? <><span className="spin" /> Reviewing…</> : "⚖️ Check Research Ethics"}
            </button>
            <button className="btn btn-g" onClick={() => setInput("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "ethics-review.txt"; document.body.appendChild(a); a.click(); }} />
      </ToolPage>
    );
  }

  // Existing tools (synthesis, gaps, draft, qa, citation, abstract)
  function SimpleToolPage({ toolId, icon, title, sub, placeholder, buildPrompt, btnLabel, inputMin = 110 }) {
    const [input, setInput] = useState("");
    const { result, loading, time, run } = useTool();
    return (
      <ToolPage id={toolId} icon={icon} title={title} sub={sub}>
        <div className="tcard">
          <div className="tcardtitle">{icon} Input</div>
          <textarea className="ti" value={input} onChange={e => setInput(e.target.value)} style={{ minHeight: inputMin }} placeholder={placeholder} />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              if (!input.trim()) { alert("Please fill in the input."); return; }
              run(buildPrompt(input) + langSuffix, SYS, (f) => saveHistEntry({ id: Date.now().toString(), tool: toolId, query: input.slice(0, 100), result: f, date: new Date().toISOString(), title: TOOL_NAMES[toolId] + ": " + input.slice(0, 50) }));
            }}>
              {loading ? <><span className="spin" /> Working…</> : btnLabel}
            </button>
            <button className="btn btn-g" onClick={() => setInput("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = toolId + ".txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }} />
      </ToolPage>
    );
  }

  function PageDraft() {
    const [input, setInput] = useState("");
    const [dtype, setDtype] = useState("literature_review");
    const [dlevel, setDlevel] = useState("masters");
    const { result, loading, time, run } = useTool();
    const tl = { literature_review: "Literature Review", introduction: "Introduction", methodology: "Methodology", abstract: "Abstract", discussion: "Discussion", conclusion: "Conclusion", proposal: "Research Proposal", rq: "Research Questions & Hypotheses" };
    const ll = { undergraduate: "Undergraduate", masters: "Master's", phd: "PhD/Doctoral", journal: "Journal" };
    return (
      <ToolPage id="draft" icon="✍️" title="Academic Draft Generator" sub="Generate structured academic content at any level — lit reviews, introductions, proposals, and more.">
        <div className="tcard">
          <div className="tcardtitle">✍️ Settings</div>
          <div className="g2">
            <div><label className="flabel">Document Type</label>
              <select className="ti" value={dtype} onChange={e => setDtype(e.target.value)}>
                {Object.entries(tl).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="flabel">Academic Level</label>
              <select className="ti" value={dlevel} onChange={e => setDlevel(e.target.value)}>
                {Object.entries(ll).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <textarea className="ti" value={input} onChange={e => setInput(e.target.value)} style={{ minHeight: 110 }} placeholder="Describe your research topic, key arguments, and any specific requirements..." />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              if (!input.trim()) { alert("Please describe your research."); return; }
              run(`Write a high-quality ${tl[dtype]} at the ${ll[dlevel]} level:\n\n"${input}"\n\nUse appropriate academic register, hedging language, representative citations. Produce polished, publication-ready content.${langSuffix}`, SYS, (f) => saveHistEntry({ id: Date.now().toString(), tool: "draft", query: input, result: f, date: new Date().toISOString(), title: tl[dtype] + ": " + input.slice(0, 45) }));
            }}>
              {loading ? <><span className="spin" /> Generating…</> : "✍️ Generate Draft"}
            </button>
            <button className="btn btn-g" onClick={() => setInput("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "draft.txt"; document.body.appendChild(a); a.click(); }} />
      </ToolPage>
    );
  }

  function PageCitation() {
    const [input, setInput] = useState("");
    const [stls, setStls] = useState({ apa: true, mla: false, chicago: false, ieee: false, vancouver: false, harvard: false });
    const { result, loading, time, run } = useTool();
    return (
      <ToolPage id="citation" icon="📎" title="Citation Formatter" sub="Paste raw reference info — get perfectly formatted citations in multiple styles simultaneously.">
        <div className="tcard">
          <div className="tcardtitle">📎 Reference Details</div>
          <textarea className="ti" value={input} onChange={e => setInput(e.target.value)} style={{ minHeight: 110 }} placeholder={"E.g.: Smith J, Jones M. 2021. Deep learning in medical imaging. Journal of Medical AI, 5, 123-145.\n\nPaste multiple references, one per line."} />
          <div style={{ marginTop: ".75rem" }}>
            <label className="flabel">Output Styles</label>
            <div className="chkrow">
              {[["apa","APA 7th"],["mla","MLA 9th"],["chicago","Chicago"],["ieee","IEEE"],["vancouver","Vancouver"],["harvard","Harvard"]].map(([k,v]) => (
                <label key={k} className="chki"><input type="checkbox" checked={stls[k]} onChange={e => setStls(p => ({...p,[k]:e.target.checked}))} /> {v}</label>
              ))}
            </div>
          </div>
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              const sel = Object.entries(stls).filter(([,v])=>v).map(([k])=>k.toUpperCase());
              if (!input.trim()) { alert("Please paste reference info."); return; }
              if (!sel.length) { alert("Select at least one style."); return; }
              run(`Format these references in ${sel.join(", ")} styles:\n\n${input}\n\nFor each reference, show all selected styles clearly labeled. Note missing fields as [missing: field].${langSuffix}`, "You are an expert academic citation formatter. Be meticulous about punctuation, capitalization, and style rules.", (f) => saveHistEntry({ id: Date.now().toString(), tool: "citation", query: input.slice(0,100), result: f, date: new Date().toISOString(), title: "Citations: " + input.slice(0,50) }));
            }}>
              {loading ? <><span className="spin" /> Formatting…</> : "📎 Format Citations"}
            </button>
            <button className="btn btn-g" onClick={() => setInput("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result],{type:"text/plain"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download="citations.txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} />
      </ToolPage>
    );
  }

  function PageAbstract() {
    const [input, setInput] = useState("");
    const [atype, setAtype] = useState("structured");
    const [words, setWords] = useState("250");
    const { result, loading, time, run } = useTool();
    return (
      <ToolPage id="abstract" icon="📄" title="Abstract Writer" sub="Describe your research and get a polished, submission-ready abstract with keyword suggestions.">
        <div className="tcard">
          <div className="tcardtitle">📄 Settings</div>
          <div className="g2">
            <div><label className="flabel">Type</label>
              <select className="ti" value={atype} onChange={e => setAtype(e.target.value)}>
                <option value="structured">Structured (IMRAD)</option><option value="unstructured">Unstructured</option><option value="informative">Informative</option><option value="descriptive">Descriptive</option>
              </select>
            </div>
            <div><label className="flabel">Word Limit</label>
              <select className="ti" value={words} onChange={e => setWords(e.target.value)}>
                <option value="150">~150 words</option><option value="250">~250 words</option><option value="300">~300 words</option><option value="500">~500 words</option>
              </select>
            </div>
          </div>
          <textarea className="ti" value={input} onChange={e => setInput(e.target.value)} style={{ minHeight: 120 }} placeholder={"Describe your research:\n• Research problem/objective\n• Methodology\n• Key findings\n• Conclusions and implications\n• Keywords (optional)"} />
          <div className="tacts">
            <button className="btn btn-p" disabled={loading} onClick={() => {
              if (!input.trim()) { alert("Please describe your research."); return; }
              run(`Write a ${atype} abstract of ~${words} words:\n\n${input}\n\n${atype==="structured"?"Use IMRAD subheadings: Background, Objective, Methods, Results, Conclusions":"Write as a cohesive paragraph"}\n\nAfter abstract:\n**Keywords:** (6-8)\n**Word Count:** [count]${langSuffix}`, SYS, (f) => saveHistEntry({ id: Date.now().toString(), tool: "abstract", query: input, result: f, date: new Date().toISOString(), title: "Abstract: " + input.slice(0,50) }));
            }}>
              {loading ? <><span className="spin" /> Writing…</> : "📄 Generate Abstract"}
            </button>
            <button className="btn btn-g" onClick={() => setInput("")}>Clear</button>
          </div>
        </div>
        <ResultBox result={result} loading={loading} time={time} onCopy={() => navigator.clipboard?.writeText(result)} onDownload={() => { const b = new Blob([result],{type:"text/plain"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download="abstract.txt"; document.body.appendChild(a); a.click(); }} />
      </ToolPage>
    );
  }

  // Dashboard page
  function PageDashboard() {
    return (
      <div>
        <div className="ptitle">Welcome back, {currentUser?.name?.split(" ")[0]}! 👋</div>
        <div className="psub">Your research activity at a glance.</div>
        <div className="stats4">
          {[["🔍",counts.synthesis,"Lit. Syntheses"],["🧠",counts.gaps,"Gap Analyses"],["🚀",counts.generator,"Articles Generated"],["🗂️",history.length,"Total Queries"]].map(([i,v,l],idx) => (
            <div key={idx} className="sc"><div className="sci">{i}</div><div className="scv">{v}</div><div className="scl">{l}</div></div>
          ))}
        </div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:600, color:"var(--navy)", marginBottom:".75rem" }}>Quick Access</div>
        <div className="qg">
          {[["🔍","Synthesize Literature","synthesis","btn-t"],["🚀","Generate Full Article","generator","btn-amber"],["📐","Format Converter","formatter","btn-o"],["✨","Humanize Writing","paraphrase","btn-o"],["🔬","Peer Review Sim","reviewer","btn-o"],["📊","Stats Help","stats","btn-o"],["🧠","Find Research Gaps","gaps","btn-o"],["📎","Format Citations","citation","btn-o"],["⚖️","Ethics Checker","ethics","btn-o"]].map(([icon,label,pg,cls],i) => (
            <button key={i} className={`btn ${cls}`} style={{ justifyContent:"flex-start", fontSize:13 }} onClick={() => navTo(pg)}>{icon} {label}</button>
          ))}
        </div>
        <div className="rc">
          <div className="rt">Recent Activity</div>
          {history.length === 0 ? <div className="empty"><div className="empi">📭</div><h3>No activity yet</h3><p>Use any research tool to see history here.</p></div>
          : history.slice(0,6).map(h => (
            <div key={h.id} className="ai" style={{ cursor:"pointer" }} onClick={() => setDetailEntry(h)}>
              <div className="aic">{TOOL_ICONS[h.tool]||"📝"}</div>
              <div className="aib"><div className="ait">{h.title?.slice(0,60)}</div><div className="aid">{fmtDate(h.date)}</div></div>
              <div className="aitag">{TOOL_NAMES[h.tool]||h.tool}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function PageHistory() {
    return (
      <div>
        <div className="ptitle">🗂️ Research History</div>
        <div className="psub">All your past queries, saved automatically.</div>
        <div style={{ display:"flex", gap:8, marginBottom:"1.1rem", flexWrap:"wrap" }}>
          <input className="ti" value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search…" style={{ maxWidth:250, minHeight:"auto", padding:"8px 12px" }} />
          <select className="ti" value={histFilter} onChange={e => setHistFilter(e.target.value)} style={{ maxWidth:180, minHeight:"auto", padding:"8px 12px" }}>
            <option value="">All Tools</option>
            {Object.entries(TOOL_NAMES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {history.length > 0 && <button className="btn btn-r btn-sm" style={{ marginLeft:"auto" }} onClick={() => { if(confirm("Clear all history?")){ setHist(currentUser.email,[]); setHistory([]); } }}>🗑 Clear All</button>}
        </div>
        {filteredHistory.length === 0
          ? <div className="empty"><div className="empi">📭</div><h3>{history.length===0?"No history yet":"No results"}</h3><p>{history.length===0?"Your research queries will appear here.":"Try different search terms."}</p></div>
          : filteredHistory.map(h => (
            <div key={h.id} className="hc" onClick={() => setDetailEntry(h)}>
              <div className="hchd">
                <div className="hct">{TOOL_ICONS[h.tool]} {h.title?.slice(0,70)}</div>
                <div className="hctool">{TOOL_NAMES[h.tool]||h.tool}</div>
              </div>
              <div className="hcprev">{h.result?.replace(/#{1,3}\s/g,"").slice(0,150)}</div>
              <div className="hcdate">{fmtDate(h.date)}</div>
              <div className="hcacts" onClick={e => e.stopPropagation()}>
                <button className="btn btn-g btn-sm" onClick={() => navigator.clipboard?.writeText(h.result)}>📋 Copy</button>
                <button className="btn btn-g btn-sm" onClick={() => { const b=new Blob([h.result],{type:"text/plain"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=h.tool+".txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}>⬇ Save</button>
                <button className="btn btn-r btn-sm" onClick={() => { if(confirm("Delete?")){ const updated=history.filter(x=>x.id!==h.id); setHist(currentUser.email,updated); setHistory(updated); } }}>🗑</button>
              </div>
            </div>
          ))
        }
      </div>
    );
  }

  function PageProfile() {
    const ud = getUsers()[currentUser?.email];
    return (
      <div>
        <div className="ptitle">👤 Profile</div>
        <div className="psub">Your account and usage.</div>
        <div className="tcard">
          <div style={{ display:"flex", alignItems:"center", gap:"1.1rem", marginBottom:"1.75rem" }}>
            <div className="profav">{initials(currentUser?.name)}</div>
            <div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:21, fontWeight:600, color:"var(--navy)" }}>{currentUser?.name}</div>
              <div style={{ color:"#78716c", fontSize:13 }}>{currentUser?.email}</div>
              <div className="bfree">Free Beta Access ✦</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"1.5rem" }}>
            {[[history.length,"Total Queries"],[counts.synthesis+counts.gaps,"Research Analyses"],[counts.draft+counts.abstract+counts.generator,"Documents Generated"]].map(([v,l],i) => (
              <div key={i} className="sc"><div className="scv">{v}</div><div className="scl">{l}</div></div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid var(--border)", paddingTop:"1.1rem" }}>
            <div style={{ fontSize:13, color:"#78716c", marginBottom:"1rem" }}>Member since: <strong>{ud ? fmtDate(ud.joined) : "N/A"}</strong></div>
            <button className="btn btn-r" onClick={doLogout}>Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar definition
  const sidebarDef = [
    { sec: "Overview", items: [{ icon:"📊", label:"Dashboard", pg:"dashboard" }] },
    { sec: "Core Tools", items: [
      { icon:"🔍", label:"Literature Synthesis", pg:"synthesis" },
      { icon:"🧠", label:"Gap Finder", pg:"gaps" },
      { icon:"❓", label:"Research Q&A", pg:"qa" },
    ]},
    { sec: "Writing Tools", items: [
      { icon:"✍️", label:"Draft Generator", pg:"draft" },
      { icon:"📄", label:"Abstract Writer", pg:"abstract" },
      { icon:"📎", label:"Citation Formatter", pg:"citation" },
    ]},
    { sec: "Advanced ✨", items: [
      { icon:"🚀", label:"Article Generator", pg:"generator", isNew:true },
      { icon:"📐", label:"Format Converter", pg:"formatter", isNew:true },
      { icon:"✨", label:"Humanizer & AI-Safe", pg:"paraphrase", isNew:true },
      { icon:"🔬", label:"Peer Review Sim", pg:"reviewer", isNew:true },
      { icon:"📊", label:"Stats Explainer", pg:"stats", isNew:true },
      { icon:"⚖️", label:"Ethics Checker", pg:"ethics", isNew:true },
    ]},
    { sec: "My Account", items: [
      { icon:"🗂️", label:"Research History", pg:"history" },
      { icon:"👤", label:"Profile", pg:"profile" },
    ]},
  ];

  const toolNavPages = ["synthesis","gaps","qa","draft","abstract","citation","generator","formatter","paraphrase","reviewer","stats","ethics"];

  // ── LANDING ──
  function Landing() {
    return (
      <div className="land">
        <div className="hero">
          <div>
            <div className="hbadge"><div className="pulse" /> ✦ AI Research Platform for Indian Researchers</div>
            <h1>Research Smarter,<br/>Publish <em>Faster</em></h1>
            <p className="hdesc">ScholarMind — your complete AI research companion. From raw data to published article, literature synthesis to ethics review. Now with full Indian language support.</p>
            <div className="hbtns">
              <button className="btn btn-p btn-lg" onClick={() => openAuth("signup")}>Start for Free →</button>
              <button className="btn btn-o btn-lg" onClick={() => openAuth("login")}>Sign In</button>
            </div>
            <div className="proof">
              <div className="avs">
                {[["PK","#0f1f3d"],["SR","#0e7490"],["ML","#d97706"],["JD","#7c3aed"]].map(([t,c],i) => (
                  <div key={i} className="asm" style={{ background:`linear-gradient(135deg,${c},${c}cc)` }}>{t}</div>
                ))}
              </div>
              <span><strong>2,400+ researchers</strong> across India trust ScholarMind</span>
            </div>
          </div>
          <div className="hvis">
            <div className="fbadge" style={{ position:"absolute", top:-14, right:22, color:"var(--teal)" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--tl)" }} />AI Analysis Ready
            </div>
            <div className="dcard">
              <div className="dtop">
                <div className="ddots">
                  {["#ef4444","#f59e0b","#22c55e"].map((c,i) => <div key={i} className="ddot" style={{ background:c }} />)}
                </div>
                <span style={{ fontSize:10, color:"rgba(255,255,255,.4)", marginLeft:6 }}>scholarmind.io</span>
              </div>
              <div className="dbody">
                <div className="msr">🔍 Search 200M+ academic papers...</div>
                <div className="mstats">
                  {[["347","Papers"],["12","Themes"],["4","Gaps"]].map(([v,l],i) => (
                    <div key={i} className="mst"><div className="mstv">{v}</div><div className="mstl">{l}</div></div>
                  ))}
                </div>
                <div className="mpap"><span className="mpt">Neural Architectures for NLP (2024)</span><span className="mpg">Relevant</span></div>
                <div className="mai"><div className="mal">⚡ AI Insight</div><div className="maln">{[90,75,85].map((w,i)=><div key={i} className="maline" style={{width:`${w}%`,animationDelay:`${i*.3}s`}}/>)}</div></div>
              </div>
            </div>
            <div className="fbadge" style={{ position:"absolute", bottom:44, left:-16, color:"var(--amber)" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--al)" }} />12 Languages Supported
            </div>
          </div>
        </div>

        <div className="logos-bar">
          <p className="logos-label">Trusted by researchers across India</p>
          <div className="logos-row">
            {["IIT Bombay","AIIMS Delhi","IISc","TIFR","NIT Trichy","IIM Ahmedabad","IIT Madras","BITS Pilani"].map(u => <div key={u} className="luni">{u}</div>)}
          </div>
        </div>

        <div className="sec">
          <div className="slabel">Capabilities</div>
          <h2 className="stitle">12 AI-powered tools for<br/>every stage of research</h2>
          <p className="sdesc">From raw data to published paper — ScholarMind handles every step of the academic research workflow.</p>
          <div className="g3">
            {[
              ["🔍","Literature Synthesis","Comprehensive field overview — themes, findings, debates, open questions."],
              ["🧠","Research Gap Finder","Identifies unexplored areas and suggests novel, feasible research directions."],
              ["🚀","Full Article Generator","From ANY raw input — topic, code, data, notes — to a complete publication-ready article.",true],
              ["📐","Format Converter","Convert your article to any journal/conference format using format specifications.",true],
              ["✨","Humanizer & AI-Safe","Rewrite text to be human-like, reduce AI-detection risk, Turnitin-safe mode.",true],
              ["🔬","Peer Review Simulator","Realistic reviewer feedback to strengthen your manuscript before submission.",true],
              ["✍️","Draft Generator","Lit reviews, introductions, methodology sections — properly structured."],
              ["📎","Citation Formatter","APA, MLA, Chicago, IEEE, Vancouver, Harvard — all simultaneously."],
              ["📄","Abstract Writer","Structured/narrative abstracts with keyword suggestions."],
              ["📊","Statistics Explainer","Plain-English explanation of statistical outputs, test selection, result reporting.",true],
              ["⚖️","Ethics Checker","IRB readiness, participant rights, data privacy, ethics compliance checklist.",true],
              ["🌐","Indian Language Support","Work in Hindi, Bengali, Tamil, Telugu, Kannada, Marathi, Gujarati, and more.",true],
            ].map(([icon,title,desc,isNew],i) => (
              <div key={i} className="fc">
                <div className="fi">{icon}</div>
                <h3>{title}{isNew && <span className="new-tag">NEW</span>}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sec" style={{ background:"#fff", margin:"0 -1.5rem", padding:"70px 1.5rem" }}>
          <div style={{ textAlign:"center", marginBottom:"2.25rem" }}>
            <div className="slabel">Pricing</div>
            <h2 className="stitle">100% Free — Open Beta</h2>
            <p className="sdesc" style={{ margin:"0 auto", textAlign:"center" }}>All 12 tools. Full access. No credit card needed.</p>
          </div>
          <div className="pcw">
            <div className="pcard">
              <div className="pname">Free Beta Access</div>
              <div className="pdesc">Everything included for all Indian researchers</div>
              <div className="pamt"><span className="pcur">$</span><span className="pnum">0</span><span className="pper">/forever</span></div>
              <div className="pdiv" />
              <ul className="pfl">
                {["Literature Synthesis (unlimited)","Full Article Generator from raw data","Format Converter (Word/LaTeX)","Humanizer & Turnitin-safe mode","Peer Review Simulator","Statistics Explainer","Ethics Checker","12 Indian language support","Research history saved forever","Copy & download all results"].map(f=><li key={f}>{f}</li>)}
              </ul>
              <button className="btn btn-white btn-lg btn-w" onClick={() => openAuth("signup")}>Get Free Access →</button>
            </div>
          </div>
        </div>

        <div className="sec">
          <div className="slabel">Testimonials</div>
          <h2 className="stitle">What Indian researchers say</h2>
          <div className="g3">
            {[
              ["PR","Prof. Priya Rajan","Associate Professor, IIT Bombay","linear-gradient(135deg,#0f1f3d,#1a3260)","The Article Generator converted my raw experimental data into a complete, well-structured paper in minutes. Saved weeks of writing time."],
              ["JM","Dr. Rahul Sharma","PhD, AIIMS Delhi","linear-gradient(135deg,#0e7490,#22d3ee)","I use the Hindi language support to brainstorm research ideas in my native language. The quality of output is genuinely impressive."],
              ["SL","Prof. Meena Nair","Research Director, IISc Bangalore","linear-gradient(135deg,#d97706,#fbbf24)","The Format Converter saved us hours when submitting to different journals. It handles IEEE and Springer formats perfectly."],
            ].map(([av,name,role,bg,text],i) => (
              <div key={i} className="tc">
                <div className="stars">★★★★★</div>
                <p className="ttxt">"{text}"</p>
                <div className="tauth">
                  <div className="tav" style={{ background:bg }}>{av}</div>
                  <div><div className="taname">{name}</div><div className="tarole">{role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ctabox">
          <h2>Ready to transform your research?</h2>
          <p>Free during open beta. Start researching in your language, in under 60 seconds.</p>
          <div className="cbtns">
            <button className="btn btn-white btn-lg" onClick={() => openAuth("signup")}>Get Started Free →</button>
          </div>
        </div>

        <div className="footer" style={{ margin:"0 -1.5rem", padding:"44px 1.5rem 22px" }}>
          <div className="fg2">
            <div className="fbrand">
              <div className="logo"><div className="logo-mark">S</div><span className="logo-text">Scholar<span>Mind</span></span></div>
              <p>AI research intelligence for the next generation of Indian academics and scientists.</p>
            </div>
            <div><div className="fcol"><h5>Tools</h5></div>
              <ul className="flinks"><li onClick={() => openAuth("signup")}>Article Generator</li><li onClick={() => openAuth("signup")}>Format Converter</li><li onClick={() => openAuth("signup")}>Literature Synthesis</li><li onClick={() => openAuth("signup")}>Ethics Checker</li></ul>
            </div>
            <div><div className="fcol"><h5>Legal</h5></div>
              <ul className="flinks"><li>Privacy Policy</li><li>Terms of Service</li><li>GDPR</li></ul>
            </div>
          </div>
          <div className="fdiv" />
          <div className="fbot"><span>© 2025 ScholarMind, Inc. All rights reserved.</span><span>Built with ♥ for researchers across India</span></div>
        </div>
      </div>
    );
  }

  // ── RENDER ──
  return (
    <>
      <style>{css}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-in">
          <div className="logo" onClick={() => view === "app" ? navTo("dashboard") : null}>
            <div className="logo-mark">S</div>
            <span className="logo-text">Scholar<span>Mind</span></span>
          </div>
          {view === "landing" && (
            <ul className="nav-links">
              <li className="nl">Features</li>
              <li className="nl">How it Works</li>
              <li className="nl">Pricing</li>
            </ul>
          )}
          {view === "app" && (
            <ul className="nav-links">
              <li className={`nl${page==="dashboard"?" on":""}`} onClick={() => navTo("dashboard")}>Dashboard</li>
              <li className={`nl${toolNavPages.includes(page)?" on":""}`} onClick={() => navTo("synthesis")}>Research Tools</li>
              <li className={`nl${page==="history"?" on":""}`} onClick={() => navTo("history")}>My History</li>
            </ul>
          )}
          <div className="nav-acts">
            {view === "landing" && (<>
              <button className="btn btn-g" onClick={() => openAuth("login")}>Sign In</button>
              <button className="btn btn-p" onClick={() => openAuth("signup")}>Get Started Free</button>
            </>)}
            {view === "app" && currentUser && (
              <div style={{ position:"relative" }}>
                <div className="upill" onClick={() => setUserDrop(p=>!p)}>
                  <div className="uav">{initials(currentUser.name)}</div>
                  <span className="uname">{currentUser.name.split(" ")[0]}</span>
                  <span style={{ color:"#78716c", fontSize:11 }}>▾</span>
                </div>
                {userDrop && (
                  <div className="drop">
                    <div className="di" onClick={() => { navTo("profile"); setUserDrop(false); }}>👤 Profile</div>
                    <div className="di" onClick={doLogout} style={{ color:"var(--err)" }}>⇠ Sign Out</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* AUTH MODAL */}
      {authModal && (
        <div className="ov" onClick={e => e.target===e.currentTarget && closeAuth()}>
          <div className="modal">
            <div className="mhd"><div className="logo-mark">S</div><button className="mclose" onClick={closeAuth}>✕</button></div>
            <div className="mbd">
              <div className="mtabs">
                <div className={`mtab${authTab==="login"?" on":""}`} onClick={() => { setAuthTab("login"); setLoginErr(""); setSignupErr(""); }}>Sign In</div>
                <div className={`mtab${authTab==="signup"?" on":""}`} onClick={() => { setAuthTab("signup"); setLoginErr(""); setSignupErr(""); }}>Create Account</div>
              </div>
              {authTab === "login" ? (<>
                <div className="mtitle">Welcome back</div>
                <div className="msub">Sign in to access your research workspace</div>
                {loginErr && <div style={{ color:"var(--err)", fontSize:12, marginBottom:".65rem" }}>{loginErr}</div>}
                <div className="fgrp"><label>Email</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="you@university.edu" onKeyDown={e=>e.key==="Enter"&&doLogin()} /></div>
                <div className="fgrp"><label>Password</label><input type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="Your password" onKeyDown={e=>e.key==="Enter"&&doLogin()} /></div>
                <button className="btn btn-p btn-lg btn-w" disabled={authLoading} onClick={doLogin}>{authLoading?<><span className="spin"/>Signing in…</>:"Sign In"}</button>
                <p className="anote">No account? <span onClick={() => setAuthTab("signup")}>Create one free →</span></p>
              </>) : (<>
                <div className="mtitle">Start for free</div>
                <div className="msub">Full access. No credit card. No limits.</div>
                {signupErr && <div style={{ color:"var(--err)", fontSize:12, marginBottom:".65rem" }}>{signupErr}</div>}
                <div className="fgrp"><label>Full name</label><input type="text" value={signupName} onChange={e=>setSignupName(e.target.value)} placeholder="Dr. Jane Smith" /></div>
                <div className="fgrp"><label>Email</label><input type="email" value={signupEmail} onChange={e=>setSignupEmail(e.target.value)} placeholder="you@university.edu" /></div>
                <div className="fgrp"><label>Password</label><input type="password" value={signupPass} onChange={e=>setSignupPass(e.target.value)} placeholder="Min. 6 characters" onKeyDown={e=>e.key==="Enter"&&doSignup()} /></div>
                <button className="btn btn-p btn-lg btn-w" disabled={authLoading} onClick={doSignup}>{authLoading?<><span className="spin"/>Creating account…</>:"Create Free Account"}</button>
                <p className="anote">Have an account? <span onClick={() => setAuthTab("login")}>Sign in →</span></p>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY DETAIL */}
      {detailEntry && (
        <div className="ov" onClick={e => e.target===e.currentTarget && setDetailEntry(null)}>
          <div className="dmod">
            <div className="dmhd">
              <div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:600, color:"var(--navy)" }}>{detailEntry.title?.slice(0,70)}</div>
                <div style={{ fontSize:12, color:"#78716c", marginTop:3 }}>{TOOL_NAMES[detailEntry.tool]} · {fmtDate(detailEntry.date)}</div>
              </div>
              <button className="btn btn-g btn-sm" onClick={() => setDetailEntry(null)}>✕ Close</button>
            </div>
            <div className="dmbd">
              <div className="dlbl">Your Query</div>
              <div className="dq">{detailEntry.query}</div>
              <div className="dlbl">AI Response</div>
              <div className="rbox">{fmtText(detailEntry.result)}</div>
              <div style={{ display:"flex", gap:6, marginTop:".9rem" }}>
                <button className="btn btn-g btn-sm" onClick={() => navigator.clipboard?.writeText(detailEntry.result)}>📋 Copy</button>
                <button className="btn btn-g btn-sm" onClick={() => { const b=new Blob([detailEntry.result],{type:"text/plain"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=detailEntry.tool+".txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}>⬇ Download</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLICK OUTSIDE DROPDOWN */}
      {userDrop && <div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={() => setUserDrop(false)} />}

      {/* LANDING */}
      {view === "landing" && <Landing />}

      {/* APP */}
      {view === "app" && (
        <div className="app-wrap">
          <aside className="sidebar">
            {/* Language Selector */}
            <div style={{ padding:"0 4px", marginBottom:".5rem" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", color:"#78716c", padding:"0 8px", marginBottom:6 }}>Language / भाषा</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {LANGS.map(l => (
                  <div key={l.code} className={`lang-chip${selLang===l.code?" on":""}`} onClick={() => setSelLang(l.code)} title={l.label}>{l.label}</div>
                ))}
              </div>
            </div>
            {sidebarDef.map(({ sec, items }) => (
              <div key={sec}>
                <div className="sb-sec">{sec}</div>
                {items.map(({ icon, label, pg, isNew }) => (
                  <div key={pg} className={`sb-item${page===pg?" on":""}`} onClick={() => navTo(pg)}>
                    <span className="sb-icon">{icon}</span>
                    {label}
                    {isNew && <span className="sb-new">NEW</span>}
                  </div>
                ))}
              </div>
            ))}
            <div style={{ marginTop:"auto", paddingTop:"1.25rem", borderTop:"1px solid var(--border)" }}>
              <button className="btn btn-r btn-sm btn-w" onClick={doLogout}>⇠ Sign Out</button>
            </div>
          </aside>

          <main className="main">
            {/* Language indicator banner */}
            {selLang !== "en" && (
              <div className="info-box" style={{ marginBottom:"1rem" }}>
                🌐 Language: <strong>{LANGS.find(l=>l.code===selLang)?.label}</strong> — AI will respond in this language across all tools.
                <button className="btn btn-g btn-sm" style={{ marginLeft:"auto", padding:"3px 10px" }} onClick={() => setSelLang("en")}>Switch to English</button>
              </div>
            )}
            {page === "dashboard" && <PageDashboard />}
            {page === "synthesis" && <SimpleToolPage toolId="synthesis" icon="🔍" title="Literature Synthesis" sub="Enter a research topic for a comprehensive field synthesis — themes, findings, methodologies, open questions." placeholder={"E.g., 'Machine learning in early cancer detection'\n\nBe specific. Include field, phenomena, and constraints."} btnLabel="⚡ Synthesize Literature" buildPrompt={input=>`Conduct a comprehensive literature synthesis on: "${input}"\n\n## 1. Overview of the Field\n## 2. Historical Development\n## 3. Major Theoretical Frameworks\n## 4. Key Findings & Evidence\n## 5. Dominant Methodological Approaches\n## 6. Debates & Controversies\n## 7. Key Scholars & Seminal Works\n## 8. Open Questions & Future Directions\n## 9. Implications\n\nBe specific and use representative citations (Author, Year).`} />}
            {page === "gaps" && <SimpleToolPage toolId="gaps" icon="🧠" title="Research Gap Finder" sub="Identify unexplored areas in your field and discover novel research directions." placeholder={"E.g., 'Renewable energy storage for developing countries'\n\nDescribe your domain. Include what you already know."} btnLabel="🧠 Find Research Gaps" buildPrompt={input=>`Identify research gaps in: "${input}"\n\n## 1. Current State\n## 2. Theoretical Gaps\n## 3. Empirical Gaps\n## 4. Methodological Gaps\n## 5. Population/Context Gaps\n## 6. Interdisciplinary Opportunities\n## 7. Applied Gaps\n## 8. 8 Specific Researchable Questions\n## 9. Recommended Approach for Top 3 Gaps`} />}
            {page === "draft" && <PageDraft />}
            {page === "qa" && <SimpleToolPage toolId="qa" icon="❓" title="Research Q&A" sub="Ask any academic question — get a structured, evidence-based answer with references and limitations." placeholder={"Examples:\n• What are the main frameworks in organizational behavior?\n• Which statistical test for 3-group comparison?\n• Explain difference between grounded theory and phenomenology."} btnLabel="❓ Get Answer" inputMin={130} buildPrompt={input=>`Answer this academic question comprehensively:\n\n"${input}"\n\n## Direct Answer\n## Detailed Explanation\n## Key Perspectives\n## Evidence & Examples\n## Limitations & Caveats\n## Practical Implications\n## Key References (5-8 seminal works)`} />}
            {page === "citation" && <PageCitation />}
            {page === "abstract" && <PageAbstract />}
            {page === "formatter" && <PageFormatter />}
            {page === "generator" && <PageGenerator />}
            {page === "reviewer" && <PageReviewer />}
            {page === "paraphrase" && <PageParaphrase />}
            {page === "stats" && <PageStats />}
            {page === "ethics" && <PageEthics />}
            {page === "history" && <PageHistory />}
            {page === "profile" && <PageProfile />}
          </main>
        </div>
      )}
    </>
  );
}
