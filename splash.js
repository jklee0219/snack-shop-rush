// 우성오락실 로고 인트로 — 게임을 켜면 맨 처음 나오는 화면.
// 옛날 오락실처럼 "화면을 터치하세요"가 깜빡이고, 터치하면(브라우저는 터치 전엔 소리를 막으므로) 소리와 함께 시작:
// 브라운관이 지잉 켜지고 → "우성오락실"이 한 글자씩 뿅! 뿅! 떨어지고 → 네온이 지지직 → 빛줄기가 띠링~.
// 그 터치로 게임 소리도 함께 켠다. 게임 위에 캔버스를 하나 덮어 그리고, 끝나면 스스로 사라진다. 연출 중 다시 누르면 건너뛴다.
// 어느 게임에든 game.js 다음에 <script src="splash.js"> 한 줄로 붙일 수 있다.
(function () {
  "use strict";
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOTAL = REDUCED ? 1.6 : 3.4, FADE = 0.4;
  const FONT = '"Galmuri11", "Apple SD Gothic Neo", monospace';
  const C = { bg: "#0e0a22", ink: "#1a1030", side: "#5a1550", pink: "#ff40a0", cyan: "#3ce6ff", yellow: "#ffd640" };
  const TITLE = ["우", "성", "오", "락", "실"];

  const cv = document.createElement("canvas");
  cv.setAttribute("aria-label", "우성오락실");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:50;touch-action:none;";
  document.body.appendChild(cv);
  const cx = cv.getContext("2d");

  let w = 0, h = 0, dpr = 1;
  function fit() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  fit(); window.addEventListener("resize", fit);

  const STARS = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random() * 0.55, p: Math.random() * 6 }));
  const SPARKS = [];
  let t0 = null, skipAt = null, done = false, shake = 0, armed = false, idleT0 = null;
  const KO = (navigator.language || "ko").toLowerCase().startsWith("ko");
  const landed = TITLE.map(() => false);

  const now = () => performance.now() / 1000;
  const R = Math.round;

  // 누르면 건너뛰기 (게임 쪽으로 터치가 새지 않게 막음)
  const skip = e => {
    e.preventDefault(); e.stopPropagation();
    try { if (typeof window.ensureAudio === "function") window.ensureAudio(); } catch (_) {}   // 이 터치로 게임 소리도 켬
    if (!armed) { armed = true; t0 = now(); playJingle(); return; }   // 첫 터치: 연출 시작
    if (skipAt === null) { skipAt = now(); hush(); }                  // 연출 중 터치: 건너뛰기
  };

  // ── 효과음 (이 화면 전용 오디오) ──
  let sx = null, sOut = null, noiseBuf = null;
  function muted() {
    try { const y = window.ytgame; if (y && y.IN_PLAYABLES_ENV && !y.system.isAudioEnabled()) return true; } catch (_) {}
    return false;
  }
  function osc(type, f0, f1, at, dur, vol) {
    const o = sx.createOscillator(), g = sx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.6);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(sOut); o.start(at); o.stop(at + dur + 0.02);
  }
  function hiss(at, dur, vol, hp) {
    const b = sx.createBufferSource(), f = sx.createBiquadFilter(), g = sx.createGain();
    b.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    b.connect(f); f.connect(g); g.connect(sOut); b.start(at); b.stop(at + dur);
  }
  function playJingle() {
    if (REDUCED || muted()) return;
    try {
      sx = new (window.AudioContext || window.webkitAudioContext)();
      sOut = sx.createGain(); sOut.gain.value = 0.55; sOut.connect(sx.destination);
      noiseBuf = sx.createBuffer(1, sx.sampleRate * 0.3, sx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (_) { sx = null; return; }
    const S = sx.currentTime + 0.03;
    osc("sawtooth", 70, 900, S, 0.28, 0.08); hiss(S, 0.2, 0.06, 1500);          // 브라운관 켜짐: 지잉
    const NOTES = [523.3, 659.3, 784.0, 1046.5, 1318.5];                         // 도 미 솔 도 미 — 한 글자씩 올라감
    NOTES.forEach((f, i) => {
      const at = S + 0.3 + i * 0.12 + 0.32;                                       // 글자가 바닥에 닿는 순간 (drawTitle 과 같은 시각)
      osc("square", f, f * 2.4, at, 0.16, 0.2);                                   // 뿅!
      osc("sine", 170, 55, at, 0.12, 0.3);                                        // 쿵 (착지)
    });
    for (const at of [S + 1.25, S + 1.37]) { hiss(at, 0.06, 0.12, 3000); osc("sawtooth", 110, 0, at, 0.06, 0.06); }   // 네온 지지직
    [1568, 2093, 2637, 3136].forEach((f, i) => osc("triangle", f, 0, S + 1.75 + i * 0.06, 0.35, 0.08));   // 빛줄기: 띠링~
  }
  function hush() {                                                  // 건너뛰면 소리도 살짝 줄이며 끔
    if (!sx) return;
    const t = sx.currentTime; sOut.gain.cancelScheduledValues(t); sOut.gain.setValueAtTime(sOut.gain.value, t); sOut.gain.linearRampToValueAtTime(0, t + 0.15);
  }
  cv.addEventListener("pointerdown", skip);
  window.addEventListener("keydown", function k(e) { if (done) return window.removeEventListener("keydown", k, true); skip(e); }, true);

  function drawBg(t, u) {
    cx.fillStyle = C.bg; cx.fillRect(0, 0, w, h);
    const hor = h * 0.64;                                          // 지평선
    const g = cx.createLinearGradient(0, hor - h * 0.32, 0, hor);
    g.addColorStop(0, "rgba(255,64,160,0)"); g.addColorStop(1, "rgba(255,64,160,.3)");
    cx.fillStyle = g; cx.fillRect(0, hor - h * 0.32, w, h * 0.32);
    for (const s of STARS) {                                      // 반짝이는 픽셀 별
      cx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + s.p));
      cx.fillStyle = "#ffffff"; cx.fillRect(R(s.x * w), R(s.y * h), Math.max(2, R(u * 0.5)), Math.max(2, R(u * 0.5)));
    }
    cx.globalAlpha = 1;
    cx.strokeStyle = C.pink; cx.lineWidth = Math.max(1, R(u * 0.25));   // 신스웨이브 바닥 격자 (앞으로 흘러옴)
    cx.beginPath();
    for (let i = -10; i <= 10; i++) { cx.moveTo(w / 2 + i * w * 0.02, hor); cx.lineTo(w / 2 + i * w * 0.32, h); }
    const sp = (t * 0.6) % 1;
    for (let i = 0; i < 9; i++) { const k = (i + sp) / 9, y = hor + (h - hor) * k * k; cx.moveTo(0, R(y)); cx.lineTo(w, R(y)); }
    cx.globalAlpha = 0.55; cx.stroke(); cx.globalAlpha = 1;
    cx.fillStyle = C.cyan; cx.fillRect(0, R(hor), w, Math.max(2, R(u * 0.3)));
  }

  // 네온 깜빡임: 다 떨어진 뒤 1.25초쯤 '지지직' 두 번 꺼졌다 켜짐
  function neon(t) {
    if (REDUCED) return 1;
    const f = t - 1.25;
    if (f < 0) return 0.55;
    if (f < 0.06 || (f > 0.12 && f < 0.17)) return 0.15;
    return 1;
  }

  const off = document.createElement("canvas"), ox = off.getContext("2d");
  function drawTitle(t, u) {
    const size = R(Math.min(w / 5.6, h * 0.15)), gap = size * 1.04;
    const cy = h * 0.4, x0 = w / 2 - gap * (TITLE.length - 1) / 2;
    const depth = Math.max(4, R(size * 0.12));                     // 입체 두께
    const T0 = REDUCED ? 0 : 0.3, STEP = REDUCED ? 0 : 0.12, DROP = REDUCED ? 0.001 : 0.32;
    const glow = neon(t);
    off.width = cv.width; off.height = cv.height; ox.setTransform(dpr, 0, 0, dpr, 0, 0);
    ox.font = `${size}px ${FONT}`; ox.textAlign = "center"; ox.textBaseline = "middle";
    const fill = ox.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);   // 노을빛 글자 (노랑 → 분홍)
    fill.addColorStop(0, "#fff3a0"); fill.addColorStop(0.45, C.yellow); fill.addColorStop(0.55, "#ff9a5a"); fill.addColorStop(1, C.pink);
    let any = false;
    TITLE.forEach((ch, i) => {
      const a = t - (T0 + i * STEP); if (a < 0) return; any = true;
      let y = cy, sq = 1;
      if (a < DROP) { const k = a / DROP; y = cy - h * 0.6 * (1 - k * k); }   // 위에서 쿵 떨어짐
      else {
        const b = a - DROP;
        if (b < 0.25 && !REDUCED) sq = 1 - Math.sin(b / 0.25 * Math.PI) * 0.22 * Math.exp(-b * 8);   // 착지하며 찌그러짐
        if (!landed[i]) {
          landed[i] = true; shake = REDUCED ? 0 : 1;
          if (!REDUCED) for (let n = 0; n < 10; n++) SPARKS.push({ x: x0 + i * gap + (Math.random() - 0.5) * size, y: cy + size * 0.5, vx: (Math.random() - 0.5) * u * 40, vy: -Math.random() * u * 25, life: 0.5 });
        }
      }
      const x = x0 + i * gap;
      ox.save(); ox.translate(x, y + size * 0.5); ox.scale(2 - sq, sq); ox.translate(0, -size * 0.5);
      for (let d = depth; d > 0; d--) { ox.fillStyle = d === depth ? C.ink : C.side; ox.fillText(ch, d, d); }   // 아래로 튀어나온 옆면
      ox.lineJoin = "round"; ox.lineWidth = Math.max(3, size * 0.09); ox.strokeStyle = C.ink; ox.strokeText(ch, 0, 0);
      ox.fillStyle = fill; ox.fillText(ch, 0, 0);
      ox.lineWidth = Math.max(1, size * 0.025); ox.strokeStyle = "rgba(255,255,255,.75)"; ox.strokeText(ch, 0, 0);   // 앞면 하이라이트 테두리
      ox.restore();
    });
    if (!any) return;
    const s = t - 1.75;                                            // 글자 위로 빛줄기가 쓱
    if (s > 0 && s < 0.55 && !REDUCED) {
      ox.globalCompositeOperation = "source-atop";
      const p = -w * 0.3 + (s / 0.55) * w * 1.6, gr = ox.createLinearGradient(p, cy - size, p + w * 0.22, cy + size);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.95)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      ox.fillStyle = gr; ox.fillRect(0, 0, w, h); ox.globalCompositeOperation = "source-over";
    }
    // 네온 빛: 분홍으로 번지는 후광을 먼저, 그 위에 글자
    cx.save(); cx.globalAlpha = glow; cx.shadowColor = C.pink; cx.shadowBlur = size * 0.45;
    cx.drawImage(off, 0, 0, w, h); cx.restore();
    cx.globalAlpha = 0.6 + 0.4 * glow; cx.drawImage(off, 0, 0, w, h); cx.globalAlpha = 1;

    const sub = t - (T0 + TITLE.length * STEP + DROP + 0.2);        // 아래: ── WOOSUNG ARCADE ──
    if (sub > 0) {
      const k = Math.min(1, sub / 0.35), ss = R(size * 0.24), y2 = cy + size * 0.95;
      cx.globalAlpha = k; cx.font = `${ss}px ${FONT}`; cx.textAlign = "center"; cx.textBaseline = "middle";
      const label = "WOOSUNG  ARCADE";
      cx.save(); if ("letterSpacing" in cx) cx.letterSpacing = `${R(ss * 0.35)}px`;
      const lw = cx.measureText(label).width;
      cx.fillStyle = C.ink; cx.fillText(label, w / 2 + 2, y2 + 2);
      cx.fillStyle = C.cyan; cx.fillText(label, w / 2, y2);
      cx.restore();
      const line = Math.min((w - lw) / 2 - 16, size * 1.4) * k, lh = Math.max(2, R(u * 0.4));
      if (line > 4) {
        cx.fillStyle = C.cyan;
        cx.fillRect(R(w / 2 - lw / 2 - 10 - line), R(y2 - lh / 2), R(line), lh);
        cx.fillRect(R(w / 2 + lw / 2 + 10), R(y2 - lh / 2), R(line), lh);
      }
      cx.globalAlpha = 1;
    }
  }

  let hold = null;                                                // 확인용: WSA_SPLASH.seek(초) 로 그 순간에 멈춤
  window.WSA_SPLASH = { seek(sec) { hold = sec; armed = true; if (t0 === null) t0 = now(); } };
  function waiting(n) {                                              // 터치 전: 별·격자 배경 + "화면을 터치하세요"
    if (idleT0 === null) idleT0 = n;
    const t = n - idleT0, u = Math.min(w, h * 0.62) / 100;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBg(t, u);
    if (Math.floor(t * 2) % 2 === 0 || REDUCED) {
      const size = R(Math.min(w / 11, h * 0.06));
      cx.font = `${size}px ${FONT}`; cx.textAlign = "center"; cx.textBaseline = "middle";
      const msg = KO ? "화면을 터치하세요" : "TAP TO START";
      cx.fillStyle = C.ink; cx.fillText(msg, w / 2 + 3, h * 0.42 + 3);
      cx.fillStyle = C.yellow; cx.fillText(msg, w / 2, h * 0.42);
      cx.font = `${R(size * 0.45)}px ${FONT}`; cx.fillStyle = C.cyan;
      cx.fillText(KO ? "TOUCH TO START  ♪" : "♪ SOUND ON", w / 2, h * 0.42 + size * 1.1);
    }
    cx.fillStyle = "rgba(0,0,0,.14)"; for (let y = 0; y < h; y += 4) cx.fillRect(0, y, w, 1);
    requestAnimationFrame(frame);
  }
  function frame() {
    const n = now();
    if (!armed) return waiting(n);
    const t = hold !== null ? hold : n - t0;
    let fade = 0;
    if (skipAt !== null) fade = Math.min(1, (n - skipAt) / 0.25);
    else if (t > TOTAL - FADE) fade = (t - (TOTAL - FADE)) / FADE;
    const u = Math.min(w, h * 0.62) / 100;
    shake = Math.max(0, shake - 1 / 60 * 6);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0) cx.translate(R((Math.random() - 0.5) * u * 1.6 * shake), R((Math.random() - 0.5) * u * 1.6 * shake));   // 쿵! 화면 흔들림
    drawBg(t, u);
    drawTitle(t, u);
    for (const p of SPARKS) {                                       // 착지 불꽃
      p.life -= 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.vy += u * 80 / 60;
      if (p.life > 0) { cx.globalAlpha = p.life / 0.5; cx.fillStyle = p.life > 0.3 ? C.yellow : C.pink; const s = Math.max(2, R(u * 0.8)); cx.fillRect(R(p.x), R(p.y), s, s); }
    }
    cx.globalAlpha = 1;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (t < 0.28 && !REDUCED) {                                    // 옛날 브라운관 켜지듯: 가운데 선이 펼쳐짐
      const k = 1 - Math.pow(1 - t / 0.28, 3), bh = Math.max(2, h * k * k);
      cx.fillStyle = "#000"; cx.fillRect(0, 0, w, (h - bh) / 2); cx.fillRect(0, (h + bh) / 2, w, h);
      cx.fillStyle = `rgba(255,255,255,${1 - k})`; cx.fillRect(0, (h - bh) / 2, w, bh);
    }
    cx.fillStyle = "rgba(0,0,0,.14)";                              // 주사선
    for (let y = 0; y < h; y += 4) cx.fillRect(0, y, w, 1);
    cv.style.opacity = String(1 - fade);
    if (fade >= 1) {
      done = true; window.removeEventListener("resize", fit); cv.remove();
      if (sx) setTimeout(() => { try { sx.close(); } catch (_) {} }, 1500);   // 남은 소리가 끝나면 정리
      return;
    }
    requestAnimationFrame(frame);
  }
  const go = () => requestAnimationFrame(frame);
  (document.fonts && document.fonts.load ? document.fonts.load(`20px "Galmuri11"`).catch(() => {}) : Promise.resolve()).then(go, go);
})();
