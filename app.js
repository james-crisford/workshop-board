(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const URL_ = window.BOARD_ENDPOINT || "";
  const CAT = { print: "Printers and plates", ebay: "eBay", custom: "Customer orders", tidy: "Tidy and bins", ask: "Ask Freddy or James" };
  const today = new Date().toLocaleDateString("en-CA");

  // Server state, plus writes waiting to reach the Sheet (kept on the phone so nothing is lost on bad signal).
  let tasks = [], ticks = {}, times = [], busy = false, clockTimer = null, loaded = false;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  let queue = store.get("wb:queue", []);
  let who = store.get("wb:who", "Tilda");

  const status = t => { $("status").textContent = t; };
  const fmtTime = s => s ? new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  const fmtDate = s => s ? new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";
  const fmtMins = m => m == null ? "" : (m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min");
  const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  const tickId = (tid, i) => tid + "__" + i;
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function noSave(why) { $("nosaveWhy").textContent = why; $("nosave").hidden = false; }
  function okSave() { $("nosave").hidden = true; }

  // Apply a write to what's on screen straight away, so the page never waits on the network.
  function applyLocal(op) {
    if (op.action === "tick") ticks[op.id] = { id: op.id, taskId: op.taskId, step: op.step, day: op.day, done: op.done, at: op.at, by: op.by };
    else if (op.action === "start") { if (!times.find(t => t.id === op.id)) times.unshift({ id: op.id, task: op.task, taskId: op.taskId, start: op.start, end: "", minutes: null, note: "", by: op.by }); }
    else if (op.action === "finish") { const t = times.find(x => x.id === op.id); if (t) { t.end = op.end; t.minutes = op.minutes; t.note = op.note; } }
    else if (op.action === "cancel") times = times.filter(t => t.id !== op.id);
  }

  function send(op) {
    op.by = who;
    applyLocal(op);
    queue.push(op); store.set("wb:queue", queue);
    render();
    flush();
  }

  let flushing = false;
  async function flush() {
    if (flushing || !URL_) return;
    flushing = true;
    try {
      while (queue.length) {
        const op = queue[0];
        const r = await fetch(URL_, { method: "POST", body: JSON.stringify(op) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "not saved");
        queue.shift(); store.set("wb:queue", queue);
      }
      okSave();
    } catch (e) {
      noSave(queue.length + (queue.length === 1 ? " change is" : " changes are") + " waiting to save.");
    }
    flushing = false;
  }

  async function load() {
    if (!URL_) { status("This page isn't connected to the save sheet yet."); noSave("The page isn't connected yet."); render(); return; }
    try {
      const r = await fetch(URL_ + "?t=" + Date.now());
      const j = await r.json();
      if (!j.ok) throw new Error("bad reply");
      tasks = j.tasks || [];
      ticks = {}; (j.ticks || []).forEach(t => { ticks[t.id] = t; });
      times = j.times || [];
      queue.forEach(applyLocal); // keep anything not saved yet on screen
      if (!loaded) status("Ready. Start with task 1.");
      loaded = true;
      render();
      flush();
    } catch (e) {
      status(loaded ? "Can't reach the save sheet right now. Your changes will save when the connection comes back." : "Can't load today's list yet. Check the Wi-Fi, then pull down to refresh.");
      if (queue.length) noSave(queue.length + " changes are waiting to save.");
      render();
    }
  }

  const running = () => times.find(t => !t.end && t.by === who);
  const doneFor = id => times.find(t => t.taskId === id && t.end);

  function pickDay() {
    const days = [...new Set(tasks.map(t => t.day).filter(Boolean))].sort();
    if (!days.length) return null;
    if (days.includes(today)) return today;
    return days.find(d => d > today) || days[days.length - 1];
  }

  function render() { renderCards(); renderLog(); }

  function renderCards() {
    const wrap = $("cards");
    const keep = {}; wrap.querySelectorAll("textarea").forEach(x => { keep[x.id] = x.value; });
    const focused = document.activeElement && document.activeElement.id;
    wrap.textContent = "";
    const day = pickDay();
    $("dayLabel").textContent = day ? ("List for " + new Date(day + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })) : "Today's list";
    const list = tasks.filter(t => t.day === day).sort((a, b) => (a.order || 0) - (b.order || 0));
    const run = running();
    if (!list.length && loaded) wrap.appendChild(el("p", "status", "No list set yet. Ask Freddy or James what to start on."));
    list.forEach((t, n) => {
      const cat = CAT[t.category] ? t.category : "ask";
      const card = el("article", "card c-" + cat);
      const done = doneFor(t.id);
      if (done) card.classList.add("is-done");
      const head = el("div", "card-head");
      head.appendChild(el("div", "num", String(n + 1)));
      const tt = el("div", "t");
      tt.appendChild(el("span", "pill c-" + cat, CAT[cat]));
      tt.appendChild(el("h3", null, t.title));
      if (t.job) tt.appendChild(el("div", "eyebrow", t.job));
      head.appendChild(tt); card.appendChild(head);
      if (t.steps && t.steps.length) {
        const ul = el("ul", "steps");
        t.steps.forEach((s, i) => {
          const li = el("li"); const id = "s-" + t.id + "-" + i;
          const td = ticks[tickId(t.id, i)];
          const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = id; cb.checked = !!(td && td.done);
          cb.addEventListener("change", () => send({ action: "tick", id: tickId(t.id, i), taskId: t.id, task: t.title, step: i, text: s, day: t.day, done: cb.checked, at: new Date().toISOString() }));
          const lb = el("label", null, s); lb.htmlFor = id;
          if (td && td.done && td.at) lb.appendChild(el("span", "tickat", " (ticked " + fmtDate(td.at) + " " + fmtTime(td.at) + ")"));
          li.append(cb, lb); ul.appendChild(li);
        });
        card.appendChild(ul);
      }
      (t.watch || []).forEach(w => { const b = el("div", "box watch"); b.appendChild(el("span", "eyebrow", "Watch out")); b.appendChild(document.createTextNode(w)); card.appendChild(b); });
      if (t.ask) { const b = el("div", "box askbox"); b.appendChild(el("span", "eyebrow", "Ask first")); b.appendChild(document.createTextNode(t.ask)); card.appendChild(b); }
      const act = el("div", "actions");
      if (run && run.taskId === t.id) {
        const c = el("span", "clock"); c.dataset.start = run.start; act.appendChild(c);
        card.appendChild(act);
        const nw = el("div", "notewrap");
        const lab = el("label", "eyebrow", "Anything slow, tricky or missing? (optional)"); lab.htmlFor = "note-" + t.id;
        const ta = document.createElement("textarea"); ta.id = "note-" + t.id; ta.value = keep[ta.id] || "";
        nw.append(lab, ta); card.appendChild(nw);
        if (focused === ta.id) setTimeout(() => ta.focus(), 0);
        const a2 = el("div", "actions");
        const f = el("button", "finish", "Finish task"); f.type = "button"; f.addEventListener("click", () => finish(run, ta.value, false));
        const x = el("button", "ghost", "Started by mistake"); x.type = "button"; x.addEventListener("click", () => finish(run, "", true));
        a2.append(f, x); card.appendChild(a2);
      } else {
        if (done) act.appendChild(el("span", "donetag", "Done in " + fmtMins(done.minutes)));
        const b = el("button", "start", done ? "Start again" : "Start"); b.type = "button";
        b.disabled = !!run || busy;
        b.addEventListener("click", () => start(t.title, t.id));
        act.appendChild(b); card.appendChild(act);
      }
      wrap.appendChild(card);
    });
    const other = run && !run.taskId ? run : null;
    $("otherRun").hidden = !other;
    if (other) { $("otherWhat").textContent = other.task; $("otherClock").dataset.start = other.start; }
    $("otherBtn").disabled = !!run;
    startClock();
  }

  function startClock() {
    clearInterval(clockTimer);
    const upd = () => document.querySelectorAll(".clock[data-start]").forEach(c => { c.textContent = clock(Date.now() - new Date(c.dataset.start).getTime()); });
    upd(); clockTimer = setInterval(upd, 1000);
  }

  function renderLog() {
    const done = times.filter(e => e.end).sort((a, b) => (b.start || "").localeCompare(a.start || "")).slice(0, 80);
    $("logTable").hidden = !done.length; $("logEmpty").hidden = !!done.length;
    const body = $("logBody"); body.textContent = "";
    done.forEach(e => {
      const tr = document.createElement("tr");
      const name = e.by && e.by !== who ? " (" + e.by + ")" : "";
      [fmtDate(e.start), e.task + name, fmtTime(e.start), fmtTime(e.end), fmtMins(e.minutes), e.note || ""].forEach((v, i) => {
        tr.appendChild(el("td", i >= 2 && i <= 4 ? "num2" : null, v));
      });
      body.appendChild(tr);
    });
  }

  function start(title, taskId) {
    if (running()) return;
    send({ action: "start", id: newId(), task: title, taskId: taskId || "", start: new Date().toISOString() });
    $("otherTask").value = "";
    status("Timer running. Press Finish as soon as this task is done.");
  }

  function finish(run, note, cancel) {
    if (!run) return;
    if (cancel) { send({ action: "cancel", id: run.id }); status("Removed. Nothing saved for that one."); return; }
    const end = new Date();
    const minutes = Math.max(1, Math.round((end - new Date(run.start)) / 60000));
    send({ action: "finish", id: run.id, end: end.toISOString(), minutes: minutes, note: (note || "").trim() });
    status("Done: " + run.task + ", " + fmtMins(minutes) + ". On to the next one.");
  }

  $("who").value = who;
  $("who").addEventListener("change", () => { who = $("who").value.trim() || "Tilda"; store.set("wb:who", who); render(); });
  $("otherBtn").addEventListener("click", () => { const v = $("otherTask").value.trim(); if (v) start(v, null); else $("otherTask").focus(); });
  $("otherTask").addEventListener("keydown", e => { if (e.key === "Enter") $("otherBtn").click(); });
  $("otherFinish").addEventListener("click", () => { const r = running(); if (r) { finish(r, $("otherNote").value, false); $("otherNote").value = ""; } });
  $("otherCancel").addEventListener("click", () => { const r = running(); if (r) finish(r, "", true); });
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

  render();
  load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
