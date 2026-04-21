/* Typing Speed Battle by 
   Single-file game logic (no backend). */

(() => {
  "use strict";

  // ---------- Utilities ----------
  const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const nowMs = () => performance.now();

  function formatPct(x) {
    const v = Math.round(x * 100);
    return `${Math.max(0, Math.min(100, v))}%`;
  }

  function formatTimeSeconds(s) {
    return `${s.toFixed(1)}s`;
  }

  function safeText(s) {
    return (s ?? "").toString();
  }

  // ---------- DSA: LCS (Dynamic Programming) ----------
  // Returns length of LCS between a and b. O(n*m) time, O(min(n,m)) memory.
  function lcsLength(a, b) {
    a = safeText(a);
    b = safeText(b);
    if (!a.length || !b.length) return 0;

    // Ensure b is shorter for memory.
    if (b.length > a.length) {
      const tmp = a;
      a = b;
      b = tmp;
    }

    const m = b.length;
    /** @type {number[]} */
    let prev = new Array(m + 1).fill(0);
    /** @type {number[]} */
    let cur = new Array(m + 1).fill(0);

    for (let i = 1; i <= a.length; i++) {
      cur[0] = 0;
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= m; j++) {
        if (ca === b.charCodeAt(j - 1)) cur[j] = prev[j - 1] + 1;
        else cur[j] = Math.max(prev[j], cur[j - 1]);
      }
      const swap = prev;
      prev = cur;
      cur = swap;
    }
    return prev[m];
  }

  // ---------- DSA: Sliding Window WPM ----------
  // WPM is computed from accepted character events over a rolling window (default 10s).
  class SlidingWindowWpm {
    constructor(windowMs = 10_000) {
      this.windowMs = windowMs;
      /** @type {{t:number, chars:number}[]} */
      this.events = [];
      this.totalChars = 0;
    }
    reset() {
      this.events = [];
      this.totalChars = 0;
    }
    push(chars, t = nowMs()) {
      if (!chars) return;
      this.events.push({ t, chars });
      this.totalChars += chars;
      this._trim(t);
    }
    _trim(t = nowMs()) {
      const cutoff = t - this.windowMs;
      while (this.events.length && this.events[0].t < cutoff) {
        const e = this.events.shift();
        this.totalChars -= e.chars;
      }
    }
    getWpm(t = nowMs()) {
      this._trim(t);
      const minutes = this.windowMs / 60_000;
      const words = this.totalChars / 5;
      return words / minutes;
    }
  }

  // ---------- DSA: Heap / Priority Queue ----------
  class MaxHeap {
    constructor(compare) {
      this.a = [];
      this.cmp = compare;
    }
    size() {
      return this.a.length;
    }
    peek() {
      return this.a[0] ?? null;
    }
    push(x) {
      this.a.push(x);
      this._siftUp(this.a.length - 1);
    }
    pop() {
      if (!this.a.length) return null;
      const top = this.a[0];
      const last = this.a.pop();
      if (this.a.length && last !== undefined) {
        this.a[0] = last;
        this._siftDown(0);
      }
      return top;
    }
    _siftUp(i) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.cmp(this.a[i], this.a[p]) <= 0) break;
        [this.a[i], this.a[p]] = [this.a[p], this.a[i]];
        i = p;
      }
    }
    _siftDown(i) {
      const n = this.a.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && this.cmp(this.a[l], this.a[best]) > 0) best = l;
        if (r < n && this.cmp(this.a[r], this.a[best]) > 0) best = r;
        if (best === i) break;
        [this.a[i], this.a[best]] = [this.a[best], this.a[i]];
        i = best;
      }
    }
  }

  // ---------- Target Text Bank ----------
  const TEXTS = {
    easy: [
      "Neon nights, fast fingers, calm mind. Type smooth and stay focused.",
      "Practice makes progress. Accuracy first, speed will follow.",
      "Small wins stack up. Keep your eyes ahead of the cursor.",
    ],
    medium: [
      "In the arena, every keystroke matters. Build rhythm, control mistakes, and keep moving forward.",
      "Speed is nothing without precision. Track the glow: green for correct, red for गलत, and adapt quickly.",
      "A clean run beats a messy sprint. Maintain pace, breathe, and let the words flow.",
    ],
    hard: [
      "Futuristic dashboards flicker as your opponent accelerates; stay composed, minimize गलत inputs, and chase a flawless streak.",
      "Your goal is consistency: read ahead, avoid panicked corrections, and let muscle memory carry you through the chaos.",
      "When pressure rises, do the basics perfectly—steady cadence, deliberate accuracy, and no wasted motion.",
    ],
  };

  function pickText(difficulty) {
    const arr = TEXTS[difficulty] ?? TEXTS.medium;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Canvas FX (Particles + Gradient Scanlines) ----------
  function createFx(canvas) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return { resize() {}, tick() {} };

    let w = 0;
    let h = 0;
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    /** @type {{x:number,y:number,vx:number,vy:number,r:number,seed:number}[]} */
    const particles = [];
    const particleCount = 70;

    function rand(a, b) {
      return a + Math.random() * (b - a);
    }

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: rand(0, w),
          y: rand(0, h),
          vx: rand(-0.25, 0.25),
          vy: rand(-0.18, 0.18),
          r: rand(0.8, 2.0),
          seed: Math.random() * 1000,
        });
      }
    }

    function tick(t) {
      ctx.clearRect(0, 0, w, h);

      // animated gradient haze
      const g = ctx.createRadialGradient(
        w * (0.3 + 0.05 * Math.sin(t * 0.0004)),
        h * (0.22 + 0.06 * Math.cos(t * 0.0005)),
        10,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.75
      );
      g.addColorStop(0, "rgba(41,243,255,0.10)");
      g.addColorStop(0.4, "rgba(255,53,215,0.06)");
      g.addColorStop(0.85, "rgba(87,255,142,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const pulse = 0.6 + 0.4 * Math.sin(t * 0.0012 + p.seed);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(232,236,255,0.20)";
        ctx.fill();
      }

      // connective lines (nearby)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 130 * 130) continue;
          const alpha = 0.10 * (1 - d2 / (130 * 130));
          ctx.strokeStyle = `rgba(41,243,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // scanlines
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#000";
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y + ((t / 25) % 4), w, 1);
      ctx.restore();
    }

    return { resize, tick };
  }

  // ---------- Game State ----------
  const screens = {
    home: $("#screenHome"),
    game: $("#screenGame"),
    end: $("#screenEnd"),
  };

  const modeLabel = $("#modeLabel");

  const btnStartFromHome = $("#btnStartFromHome");
  const btnHowTo = $("#btnHowTo");
  const howto = $("#howto");

  const typingInput = /** @type {HTMLTextAreaElement} */ ($("#typingInput"));
  const targetTextEl = $("#targetText");
  const liveHint = $("#liveHint");

  const btnStart = $("#btnStart");
  const btnPause = $("#btnPause");
  const btnReset = $("#btnReset");

  const difficultyChip = $("#difficultyChip");
  const timeChip = $("#timeChip");

  const userProgress = $("#userProgress");
  const aiProgress = $("#aiProgress");
  const userPct = $("#userPct");
  const aiPct = $("#aiPct");
  const aiTag = $("#aiTag");

  const statWpm = $("#statWpm");
  const statAcc = $("#statAcc");
  const statErr = $("#statErr");
  const statTime = $("#statTime");
  const statChars = $("#statChars");
  const statCorrect = $("#statCorrect");
  const statAiWpm = $("#statAiWpm");

  const countdown = $("#countdown");
  const countdownNum = $("#countdownNum");

  const btnPlayAgain = $("#btnPlayAgain");
  const btnBackHome = $("#btnBackHome");
  const btnSaveScore = $("#btnSaveScore");
  const playerName = /** @type {HTMLInputElement} */ ($("#playerName"));

  const endSub = $("#endSub");
  const endWpm = $("#endWpm");
  const endAcc = $("#endAcc");
  const endErr = $("#endErr");
  const endTime = $("#endTime");

  const toggleAI = /** @type {HTMLInputElement} */ ($("#toggleAI"));

  const btnOpenLeaderboard = $("#btnOpenLeaderboard");
  const modalLeaderboard = $("#modalLeaderboard");
  const btnCloseLeaderboard = $("#btnCloseLeaderboard");
  const leaderboardList = $("#leaderboardList");
  const btnClearLeaderboard = $("#btnClearLeaderboard");

  const STORAGE_KEY = "tsb_leaderboard_v1";

  // HashMap-style stats store (string->number)
  /** @type {Map<string, number>} */
  const statsMap = new Map();

  const wpmWindow = new SlidingWindowWpm(10_000);
  const aiWpmWindow = new SlidingWindowWpm(10_000);

  const state = {
    screen: "home",
    status: "idle", // idle | countdown | running | paused | ended
    difficulty: "medium",
    durationSec: 60,
    startedAtMs: 0,
    elapsedMs: 0,
    rafId: 0,
    timerId: 0,
    target: "",
    typed: "",
    lastInputLen: 0,
    totals: {
      typedLen: 0,
      lcsLen: 0,
      errors: 0,
      paragraphs: 0,
    },
    aiEnabled: false,
    ai: {
      typed: "",
      index: 0,
      running: false,
      intervalId: 0,
      wpmBase: 48,
      mistakeProb: 0.06,
      burstiness: 0.25,
    },
  };

  // ---------- Screen Router ----------
  function setScreen(name) {
    state.screen = name;
    for (const k of Object.keys(screens)) screens[k].classList.remove("screen--active");
    screens[name].classList.add("screen--active");
    modeLabel.textContent = name[0].toUpperCase() + name.slice(1);
  }

  // ---------- Typing Rendering (String Matching / per-char highlight) ----------
  function renderTarget(target, typed, currentIdx) {
    // Build spans; keep it lightweight for short paragraphs.
    const frag = document.createDocumentFragment();
    for (let i = 0; i < target.length; i++) {
      const span = document.createElement("span");
      span.className = "ch";
      const tCh = target[i];
      const uCh = typed[i];
      if (i < typed.length) {
        if (uCh === tCh) span.classList.add("ch--ok");
        else span.classList.add("ch--bad");
      }
      // Keep UI simple: no "moving cursor" effect on text.
      span.textContent = tCh;
      frag.appendChild(span);
    }
    targetTextEl.replaceChildren(frag);
  }

  function computeErrors(target, typed) {
    let errors = 0;
    const n = Math.min(target.length, typed.length);
    for (let i = 0; i < n; i++) if (typed[i] !== target[i]) errors++;
    // extra chars beyond target count as errors too
    errors += Math.max(0, typed.length - target.length);
    return errors;
  }

  function computeAccuracyLcs(target, typed) {
    if (!typed.length) return 1;
    const lcs = lcsLength(target, typed);
    // accuracy defined as lcs / typed length (typed correctness proportion)
    return typed.length ? lcs / typed.length : 1;
  }

  function updateProgressBars() {
    const pctUser = state.target.length ? clamp01(state.typed.length / state.target.length) : 0;
    userProgress.style.width = `${(pctUser * 100).toFixed(1)}%`;
    userPct.textContent = `${Math.round(pctUser * 100)}%`;

    const pctAi = state.target.length ? clamp01(state.ai.typed.length / state.target.length) : 0;
    aiProgress.style.width = `${(pctAi * 100).toFixed(1)}%`;
    aiPct.textContent = `${Math.round(pctAi * 100)}%`;
  }

  function updateStatsUi() {
    const t = nowMs();
    const wpm = state.status === "running" || state.status === "paused" ? wpmWindow.getWpm(t) : 0;
    const curTypedLen = state.typed.length;
    const curLcs = curTypedLen ? lcsLength(state.target, state.typed) : 0;
    const curErrors = computeErrors(state.target, state.typed);

    const typedTotal = state.totals.typedLen + curTypedLen;
    const lcsTotal = state.totals.lcsLen + curLcs;
    const errTotal = state.totals.errors + curErrors;
    const acc = typedTotal ? lcsTotal / typedTotal : 1;

    statsMap.set("wpm", wpm);
    statsMap.set("accuracy", acc);
    statsMap.set("errors", errTotal);
    statsMap.set("charsTyped", typedTotal);
    statsMap.set("charsCorrect", Math.max(0, typedTotal - errTotal));
    statsMap.set("paragraphs", state.totals.paragraphs);

    statWpm.textContent = `${Math.round(wpm)}`;
    statAcc.textContent = formatPct(acc);
    statErr.textContent = `${errTotal}`;
    statChars.textContent = `${typedTotal}`;
    statCorrect.textContent = `${Math.max(0, typedTotal - errTotal)}`;

    if (state.aiEnabled) {
      const aiWpm = aiWpmWindow.getWpm(t);
      statAiWpm.textContent = `${Math.round(aiWpm)}`;
    } else {
      statAiWpm.textContent = "—";
    }

    updateProgressBars();
  }

  // ---------- Timer Loop ----------
  function remainingSeconds() {
    const total = state.durationSec * 1000;
    const rem = Math.max(0, total - state.elapsedMs);
    return rem / 1000;
  }

  function tickTimer() {
    if (state.status !== "running") return;
    const t = nowMs();
    state.elapsedMs = t - state.startedAtMs;
    const rem = remainingSeconds();
    statTime.textContent = formatTimeSeconds(rem);

    if (rem <= 0) {
      finishGame("Time's up!");
      return;
    }
    updateStatsUi();
  }

  function startLoops() {
    stopLoops();
    state.timerId = window.setInterval(tickTimer, 50);
  }

  function stopLoops() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = 0;
  }

  // ---------- AI Opponent ----------
  function aiParamsForDifficulty(difficulty) {
    if (difficulty === "easy") return { wpmBase: 34, mistakeProb: 0.05, burstiness: 0.22 };
    if (difficulty === "hard") return { wpmBase: 62, mistakeProb: 0.08, burstiness: 0.34 };
    return { wpmBase: 48, mistakeProb: 0.06, burstiness: 0.28 };
  }

  function randomMistakeChar(targetChar) {
    // a nearby ASCII-ish mistake; preserve spaces occasionally
    if (targetChar === " " && Math.random() < 0.65) return " ";
    const pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ,.!?;:'\"-";
    let c = pool[Math.floor(Math.random() * pool.length)];
    if (c === targetChar) c = pool[(pool.indexOf(c) + 7) % pool.length];
    return c;
  }

  function aiStop() {
    state.ai.running = false;
    if (state.ai.intervalId) window.clearTimeout(state.ai.intervalId);
    state.ai.intervalId = 0;
  }

  function aiScheduleNext() {
    if (!state.aiEnabled) return;
    if (state.status !== "running") return;
    if (!state.ai.running) return;
    if (state.ai.index >= state.target.length) return;

    const { wpmBase, mistakeProb, burstiness } = state.ai;
    // ms per char ~ 60_000 / (wpm * 5)
    const baseMs = 60_000 / (Math.max(10, wpmBase) * 5);
    const jitter = 1 + (Math.random() * 2 - 1) * burstiness;
    const pause = Math.random() < 0.04 ? 220 + Math.random() * 260 : 0; // human-ish pause
    const delay = Math.max(20, baseMs * jitter + pause);

    state.ai.intervalId = window.setTimeout(() => {
      if (state.status !== "running" || !state.ai.running) return;
      const i = state.ai.index;
      const targetChar = state.target[i];
      const makeMistake = Math.random() < mistakeProb;
      const outChar = makeMistake ? randomMistakeChar(targetChar) : targetChar;

      state.ai.typed += outChar;
      state.ai.index++;
      aiWpmWindow.push(1, nowMs());

      // Update AI bar quickly
      updateProgressBars();
      aiScheduleNext();
    }, delay);
  }

  function aiStart() {
    aiStop();
    if (!state.aiEnabled) return;
    const p = aiParamsForDifficulty(state.difficulty);
    state.ai.wpmBase = p.wpmBase + Math.round((Math.random() * 2 - 1) * 4);
    state.ai.mistakeProb = p.mistakeProb;
    state.ai.burstiness = p.burstiness;
    state.ai.typed = "";
    state.ai.index = 0;
    state.ai.running = true;
    aiWpmWindow.reset();
    aiScheduleNext();
  }

  // ---------- Game Flow ----------
  function setDifficulty(difficulty) {
    state.difficulty = difficulty;
    difficultyChip.textContent = `Difficulty: ${difficulty[0].toUpperCase() + difficulty.slice(1)}`;
  }

  function setDuration(sec) {
    state.durationSec = sec;
    timeChip.textContent = `Time: ${sec}s`;
    statTime.textContent = formatTimeSeconds(sec);
  }

  function setAiEnabled(on) {
    state.aiEnabled = on;
    toggleAI.checked = on;
    aiTag.textContent = on ? "ON" : "OFF";
    aiTag.style.borderColor = on ? "rgba(255,53,215,.55)" : "rgba(28,36,84,.8)";
    aiTag.style.color = on ? "rgba(232,236,255,.95)" : "rgba(150,160,215,.95)";
    if (!on) {
      aiStop();
      state.ai.typed = "";
      state.ai.index = 0;
      aiWpmWindow.reset();
      updateProgressBars();
      statAiWpm.textContent = "—";
    }
  }

  function resetRound({ keepText = false } = {}) {
    stopLoops();
    aiStop();
    state.status = "idle";
    state.startedAtMs = 0;
    state.elapsedMs = 0;
    state.typed = "";
    state.lastInputLen = 0;
    state.totals.typedLen = 0;
    state.totals.lcsLen = 0;
    state.totals.errors = 0;
    state.totals.paragraphs = 0;
    typingInput.value = "";
    typingInput.disabled = true;

    if (!keepText) state.target = pickText(state.difficulty);
    state.ai.typed = "";
    state.ai.index = 0;
    wpmWindow.reset();
    aiWpmWindow.reset();

    countdown.hidden = true;
    liveHint.textContent = "Ready.";

    renderTarget(state.target, state.typed, 0);
    updateProgressBars();
    updateStatsUi();
    statTime.textContent = formatTimeSeconds(state.durationSec);
  }

  function advanceParagraph() {
    // finalize current paragraph into totals
    const typed = state.typed;
    if (typed.length) {
      const lcs = lcsLength(state.target, typed);
      const errors = computeErrors(state.target, typed);
      state.totals.typedLen += typed.length;
      state.totals.lcsLen += lcs;
      state.totals.errors += errors;
      state.totals.paragraphs += 1;
    }

    // load next paragraph within the same timer
    state.target = pickText(state.difficulty);
    state.typed = "";
    state.lastInputLen = 0;
    typingInput.value = "";

    // reset per-paragraph progress bars
    state.ai.typed = "";
    state.ai.index = 0;

    renderTarget(state.target, "", 0);
    updateProgressBars();
    updateStatsUi();

    if (state.aiEnabled && state.status === "running") {
      state.ai.running = true;
      aiScheduleNext();
    }
  }

  function beginCountdown() {
    // Countdown removed (users asked to keep it simple).
    if (state.status === "running") return;
    countdown.hidden = true;
    startGame();
  }

  function startGame() {
    state.status = "running";
    state.startedAtMs = nowMs() - state.elapsedMs;
    typingInput.disabled = false;
    typingInput.focus();
    liveHint.textContent = state.aiEnabled ? "Race live: you vs AI." : "Run live: solo.";

    startLoops();
    if (state.aiEnabled) aiStart();
  }

  function pauseGame() {
    if (state.status === "countdown") {
      state.status = "paused";
      countdown.hidden = true;
      liveHint.textContent = "Paused.";
      return;
    }
    if (state.status !== "running") return;
    state.status = "paused";
    stopLoops();
    aiStop();
    typingInput.disabled = true;
    liveHint.textContent = "Paused.";
  }

  function resumeGame() {
    if (state.status !== "paused") return;
    state.status = "running";
    state.startedAtMs = nowMs() - state.elapsedMs;
    typingInput.disabled = false;
    typingInput.focus();
    liveHint.textContent = "Resumed.";
    startLoops();
    if (state.aiEnabled) {
      state.ai.running = true;
      aiScheduleNext();
    }
  }

  function finishGame(reason) {
    if (state.status === "ended") return;
    state.status = "ended";
    stopLoops();
    aiStop();
    typingInput.disabled = true;

    const rem = remainingSeconds();
    const timeUsed = state.durationSec - rem;

    const wpm = statsMap.get("wpm") ?? 0;
    const acc = statsMap.get("accuracy") ?? 1;
    const err = statsMap.get("errors") ?? 0;

    endSub.textContent = reason;
    endWpm.textContent = `${Math.round(wpm)}`;
    endAcc.textContent = formatPct(acc);
    endErr.textContent = `${err}`;
    endTime.textContent = `${timeUsed.toFixed(1)}s`;

    setScreen("end");
  }

  // ---------- Input handling ----------
  function onTypingInput() {
    if (state.status !== "running") return;
    const val = typingInput.value.replace(/\r\n/g, "\n");
    state.typed = val;

    // Sliding-window event: characters added since last input (ignore deletions)
    const delta = Math.max(0, val.length - state.lastInputLen);
    if (delta) wpmWindow.push(delta, nowMs());
    state.lastInputLen = val.length;

    const idx = Math.min(val.length, state.target.length);
    renderTarget(state.target, val, idx);
    updateStatsUi();

    const pctUser = state.target.length ? val.length / state.target.length : 0;
    if (pctUser >= 1) {
      advanceParagraph();
      return;
    }
  }

  // ---------- Leaderboard ----------
  // Score object: {name,wpm,acc,errors,ts,difficulty,duration,ai}
  function loadScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveScores(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 60)));
  }

  function heapRankScores(arr) {
    const heap = new MaxHeap((x, y) => {
      // Primary: wpm, secondary: accuracy, tertiary: lowest errors, then recent
      if (x.wpm !== y.wpm) return x.wpm - y.wpm;
      if (x.acc !== y.acc) return x.acc - y.acc;
      if (x.errors !== y.errors) return -(x.errors - y.errors);
      return x.ts - y.ts;
    });
    for (const s of arr) heap.push(s);
    /** @type {any[]} */
    const out = [];
    while (heap.size()) out.push(heap.pop());
    return out;
  }

  function renderLeaderboard() {
    const scores = heapRankScores(loadScores());
    if (!scores.length) {
      leaderboardList.innerHTML =
        '<div class="muted">No scores yet. Play a match and save your score.</div>';
      return;
    }
    const top = scores.slice(0, 20);
    leaderboardList.replaceChildren(
      ...top.map((s, i) => {
        const row = document.createElement("div");
        row.className = "lbRow";
        row.innerHTML = `
          <div class="lbRow__rank">#${i + 1}</div>
          <div class="lbRow__name">${escapeHtml(s.name)}</div>
          <div class="lbRow__wpm"><b>${Math.round(s.wpm)}</b> WPM</div>
          <div class="lbRow__meta">${Math.round(s.acc * 100)}% • ${s.difficulty} • ${s.duration}s</div>
        `;
        return row;
      })
    );
  }

  function escapeHtml(s) {
    return safeText(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openLeaderboard() {
    modalLeaderboard.hidden = false;
    renderLeaderboard();
  }
  function closeLeaderboard() {
    modalLeaderboard.hidden = true;
  }

  function saveCurrentScore() {
    const name = safeText(playerName.value).trim() || "Player";
    const wpm = statsMap.get("wpm") ?? 0;
    const acc = statsMap.get("accuracy") ?? 1;
    const errors = statsMap.get("errors") ?? 0;
    const score = {
      name: name.slice(0, 18),
      wpm: Math.max(0, wpm),
      acc: clamp01(acc),
      errors: Math.max(0, Math.floor(errors)),
      ts: Date.now(),
      difficulty: state.difficulty,
      duration: state.durationSec,
      ai: state.aiEnabled,
    };
    const arr = loadScores();
    arr.push(score);
    saveScores(arr);
    openLeaderboard();
  }

  // ---------- Wiring: Controls ----------
  function setSegActive(btns, activeBtn) {
    for (const b of btns) b.classList.toggle("seg__btn--active", b === activeBtn);
  }

  $$(".seg__btn[data-difficulty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.getAttribute("data-difficulty") || "medium";
      setSegActive($$(".seg__btn[data-difficulty]"), btn);
      setDifficulty(d);
      resetRound();
    });
  });

  $$(".seg__btn[data-time]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = Number(btn.getAttribute("data-time") || "60");
      setSegActive($$(".seg__btn[data-time]"), btn);
      setDuration(t);
      resetRound({ keepText: true });
    });
  });

  toggleAI.addEventListener("change", () => {
    setAiEnabled(toggleAI.checked);
    resetRound({ keepText: true });
  });

  btnStartFromHome.addEventListener("click", () => {
    setScreen("game");
    resetRound();
  });

  btnHowTo.addEventListener("click", () => {
    howto.hidden = !howto.hidden;
  });

  btnStart.addEventListener("click", () => {
    if (state.status === "running") return;
    if (state.status === "paused") {
      resumeGame();
      return;
    }
    beginCountdown();
  });

  btnPause.addEventListener("click", () => {
    if (state.status === "paused") resumeGame();
    else pauseGame();
  });

  btnReset.addEventListener("click", () => {
    resetRound();
  });

  typingInput.addEventListener("input", onTypingInput);

  btnPlayAgain.addEventListener("click", () => {
    setScreen("game");
    resetRound();
  });
  btnBackHome.addEventListener("click", () => {
    setScreen("home");
  });

  btnSaveScore.addEventListener("click", () => {
    saveCurrentScore();
  });

  btnOpenLeaderboard.addEventListener("click", openLeaderboard);
  btnCloseLeaderboard.addEventListener("click", closeLeaderboard);
  btnClearLeaderboard.addEventListener("click", () => {
    saveScores([]);
    renderLeaderboard();
  });

  modalLeaderboard.addEventListener("click", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t?.getAttribute("data-close") === "true") closeLeaderboard();
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modalLeaderboard.hidden) {
        closeLeaderboard();
        return;
      }
      if (state.screen === "game") {
        if (state.status === "running") pauseGame();
        else if (state.status === "paused") resumeGame();
      }
    }
    if (state.screen === "game" && e.ctrlKey && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      resetRound();
    }
  });

  // Auto-end conditions check (AI win) in the UI loop
  function uiRafLoop() {
    if (state.screen === "game" && state.status === "running") {
      const rem = remainingSeconds();
      statTime.textContent = formatTimeSeconds(rem);
      updateStatsUi();
    }
    state.rafId = window.requestAnimationFrame(uiRafLoop);
  }

  function startUiRaf() {
    if (state.rafId) window.cancelAnimationFrame(state.rafId);
    state.rafId = window.requestAnimationFrame(uiRafLoop);
  }

  // ---------- Init ----------
  function init() {
    // Background FX disabled to keep design simple.

    setDifficulty("medium");
    setDuration(60);
    setAiEnabled(false);
    setScreen("home");

    // Prepare game screen state (text pre-render)
    state.target = pickText(state.difficulty);
    renderTarget(state.target, "", 0);
    resetRound({ keepText: true });

    // Start UI loop
    startUiRaf();
  }

  init();
})();
