// 분식집 알바 (Snack Shop Rush) — 우성오락실
// 손님이 주문한 음식을 조리대에서 만들어 쟁반에 올리고, 손님을 눌러 건네면 돈을 번다.
// 하루 영업 60초. 목표 매출을 넘기면 다음 날로, 번 돈으로 가게를 업그레이드한다.
// 화난 손님이 3명이 되면 사장님 호출로 그날 영업 끝.
// YouTube Playables 요건: SDK 먼저, firstFrameReady/gameReady, onPause/onResume 로만 정지,
// 유튜브 음소거 따름, saveData/loadData, 모든 화면비, 터치·마우스.
"use strict";

// ───────────── 유튜브 SDK (밖에서는 localStorage) ─────────────
const YT = (typeof ytgame !== "undefined") ? ytgame : null;
const IN_YT = !!(YT && YT.IN_PLAYABLES_ENV);
const SAVE_KEY = "woosung-bunsik-v1";
const sdk = {
  firstFrameReady() { try { YT && YT.game.firstFrameReady(); } catch (e) {} },
  gameReady() { try { YT && YT.game.gameReady(); } catch (e) {} },
  async load() {
    if (IN_YT) { try { return await YT.game.loadData(); } catch (e) { return ""; } }
    try { return localStorage.getItem(SAVE_KEY) || ""; } catch (e) { return ""; }
  },
  async save(str) {
    if (IN_YT) { try { await YT.game.saveData(str); } catch (e) {} return; }
    try { localStorage.setItem(SAVE_KEY, str); } catch (e) {}
  },
  score(v) { if (IN_YT) { try { YT.engagement.sendScore({ value: Math.floor(v) }); } catch (e) {} } },
  audioOn() { if (IN_YT) { try { return YT.system.isAudioEnabled(); } catch (e) {} } return true; },
  async lang() { if (IN_YT) { try { return await YT.system.getLanguage(); } catch (e) {} } return navigator.language || "ko"; },
  interstitial() { if (IN_YT) { try { return YT.ads.requestInterstitialAd(); } catch (e) {} } return Promise.resolve(); },
};

const TEXT = {
  ko: { title: "분식집 알바", start: "출근하기!", shop: "가게 업그레이드", day: d => `${d}일차`, goal: "목표",
        left: s => `${s}초`, won: n => `${n.toLocaleString("ko-KR")}원`, best: "최고 하루 매출",
        wallet: "가진 돈", closed: "영업 종료!", boss: "사장님 호출!", pass: "목표 달성!", fail: "목표 실패…",
        earned: "오늘 번 돈", served: n => `손님 ${n}명`, angry: n => `화난 손님 ${n}명`,
        next: "다음 날 출근", retry: "다시 도전", back: "돌아가기", buy: "구매", max: "최고 단계",
        done: "완성!", burnt: "탔어요!", toss: "버리기", trash: "버리기", locked: d => `${d}일차부터`,
        roll: "말기", combo: n => `${n}콤보!`, tip: "팁", full: "쟁반이 꽉 찼어요!",
        hint: "주문 확인 → 조리대 눌러 요리 → 완성되면 눌러 쟁반에 → 손님 눌러 전달!",
        newMenu: m => `새 메뉴: ${m}!`, oops: "앗! 손님이 화났어요" },
  en: { title: "Snack Shop Rush", start: "Start shift!", shop: "Upgrades", day: d => `Day ${d}`, goal: "Goal",
        left: s => `${s}s`, won: n => `₩${n.toLocaleString("en-US")}`, best: "Best day",
        wallet: "Wallet", closed: "Closing time!", boss: "Boss is mad!", pass: "Goal reached!", fail: "Goal missed…",
        earned: "Today's sales", served: n => `${n} served`, angry: n => `${n} angry`,
        next: "Next day", retry: "Try again", back: "Back", buy: "Buy", max: "MAX",
        done: "Ready!", burnt: "Burnt!", toss: "Toss", trash: "Toss", locked: d => `Day ${d}`,
        roll: "Roll", combo: n => `${n} combo!`, tip: "tip", full: "Tray is full!",
        hint: "Read order → tap station to cook → tap when ready → tap customer to serve!",
        newMenu: m => `New menu: ${m}!`, oops: "Oh no, a customer left angry" },
};
let T = TEXT.ko;

// ───────────── 메뉴·업그레이드 ─────────────
// kind: cook = 눌러서 시작 → 시간이 지나면 완성 → 오래 두면 탐 / roll = 여러 번 눌러 말기 / grab = 바로 꺼냄
const MENU = [
  { id: "tteok",  ko: "떡볶이", en: "Tteokbokki", price: 3000, kind: "cook", cook: 3.2, day: 1 },
  { id: "kimbap", ko: "김밥",   en: "Gimbap",     price: 2500, kind: "roll", taps: 3,   day: 1 },
  { id: "ramen",  ko: "라면",   en: "Ramyeon",    price: 3500, kind: "cook", cook: 4.2, day: 3 },
  { id: "eomuk",  ko: "어묵",   en: "Eomuk",      price: 1000, kind: "grab",            day: 2 },
  { id: "twigim", ko: "튀김",   en: "Twigim",     price: 2000, kind: "cook", cook: 2.6, day: 4 },
];
const M = Object.fromEntries(MENU.map(m => [m.id, m]));
const BURN_AFTER = 4;            // 완성 후 이 초가 지나면 탄다
const DAY_LEN = 60;              // 하루 영업 시간(초)
const UPGRADES = [
  { id: "fire",  ko: "화력 강화",   en: "Hotter stoves", dko: "조리 시간 15% 단축",  den: "Cook 15% faster",       base: 6000 },
  { id: "tray",  ko: "큰 쟁반",     en: "Bigger tray",   dko: "쟁반 칸 +1",          den: "+1 tray slot",          base: 5000 },
  { id: "deco",  ko: "인테리어",    en: "Cozy decor",    dko: "손님 인내심 +15%",     den: "Customers wait 15% longer", base: 7000 },
  { id: "price", ko: "맛집 소문",   en: "Word of mouth", dko: "음식값 +10%",          den: "Prices +10%",           base: 9000 },
];
const MAX_UP = 3;
const upCost = (u, lv) => Math.round(u.base * Math.pow(lv + 1, 1.6) / 1000) * 1000;
const C = { pink: "#ff40a0", cyan: "#3ce6ff", yellow: "#ffd640", green: "#5cff8a", red: "#ff4d6d", ink: "#1a1030", night: "#0e0a22" };

// ───────────── 상태 ─────────────
const st = {
  mode: "title", ready: false, paused: false, t: 0,
  day: 1, money: 0, best: 0, plays: 0, up: { fire: 0, tray: 0, deco: 0, price: 0 },
  time: DAY_LEN, earn: 0, served: 0, angryN: 0, combo: 0,
  customers: [null, null, null], tray: [], stations: {}, spawnT: 0,
  pops: [], banner: null, bannerT: 0, shake: 0, result: null, hits: [],
};
const goalOf = d => 20000 + (d - 1) * 8000;                   // 사람 손 속도 시뮬레이션 기준: 3일차쯤부터 빠듯
const unlocked = id => st.day >= M[id].day;
const cookTime = m => m.cook * Math.pow(0.85, st.up.fire);
const trayCap = () => 3 + st.up.tray;
const priceOf = m => Math.round(m.price * (1 + 0.1 * st.up.price) / 100) * 100;

function resetStations() {
  for (const m of MENU) st.stations[m.id] = { state: "idle", t: 0, taps: 0, cd: 0, shake: 0 };
}

// ───────────── 저장 ─────────────
function save() { sdk.save(JSON.stringify({ v: 1, day: st.day, money: st.money, best: st.best, plays: st.plays, up: st.up })); }
async function loadSave() {
  const raw = await sdk.load(); if (!raw) return;
  try {
    const d = JSON.parse(raw);
    st.day = Math.max(1, d.day | 0); st.money = Math.max(0, d.money | 0); st.best = Math.max(0, d.best | 0); st.plays = d.plays | 0;
    for (const u of UPGRADES) st.up[u.id] = Math.min(MAX_UP, Math.max(0, (d.up && d.up[u.id]) | 0));
  } catch (e) {}
}

// ───────────── 소리 ─────────────
let actx = null, master = null, audioEnabled = true;
function ensureAudio() {
  if (actx) { if (actx.state === "suspended" && audioEnabled) actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = audioEnabled ? 0.3 : 0; master.connect(actx.destination);
  } catch (e) { actx = null; }
}
function setAudio(on) { audioEnabled = on; if (master) master.gain.value = on ? 0.3 : 0; }
function tone(f, dur, type = "square", vol = 0.25, slide = 0) {
  if (!actx || !audioEnabled || st.paused) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  tap() { tone(520, 0.04, "square", 0.1); },
  start() { tone(330, 0.08, "triangle", 0.18, 1.6); },
  ding() { tone(1319, 0.08, "square", 0.14); setTimeout(() => tone(1760, 0.14, "square", 0.12), 70); },
  tray() { tone(660, 0.05, "square", 0.12); setTimeout(() => tone(880, 0.06, "square", 0.12), 40); },
  pay() { [988, 1319, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.07, "square", 0.15), i * 55)); },
  angry() { tone(220, 0.2, "sawtooth", 0.2, 0.6); setTimeout(() => tone(150, 0.25, "sawtooth", 0.2, 0.6), 160); },
  burn() { tone(120, 0.35, "sawtooth", 0.18, 0.5); },
  no() { tone(180, 0.08, "square", 0.14); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, "square", 0.18), i * 110)); },
};

// ───────────── 영업 ─────────────
function startDay() {
  ensureAudio();
  st.mode = "play"; st.time = DAY_LEN; st.earn = 0; st.served = 0; st.angryN = 0; st.combo = 0;
  st.customers = [null, null, null]; st.tray = []; st.pops = []; st.spawnT = 0.6; resetStations();
  const fresh = MENU.find(m => m.day === st.day && st.day > 1);
  banner(fresh ? (T === TEXT.ko ? TEXT.ko.newMenu(fresh.ko) : TEXT.en.newMenu(fresh.en)) : `${T.day(st.day)} · ${T.goal} ${T.won(goalOf(st.day))}`, C.yellow);
  sfx.start();
}

function spawnCustomer() {
  const free = st.customers.map((c, i) => c ? -1 : i).filter(i => i >= 0);
  if (!free.length) return;
  const slot = free[Math.floor(Math.random() * free.length)];
  const menu = MENU.filter(m => unlocked(m.id));
  const d = st.day;
  let n = 1;
  if (Math.random() < Math.min(0.6, 0.12 + d * 0.08)) n++;
  if (d >= 3 && Math.random() < Math.min(0.4, (d - 2) * 0.07)) n++;
  const order = Array.from({ length: n }, () => menu[Math.floor(Math.random() * menu.length)].id).sort();
  const pat = Math.max(11, 24 - d * 0.9) * (1 + 0.15 * st.up.deco);
  st.customers[slot] = { look: Math.floor(Math.random() * 8), order, got: order.map(() => false), pat, patMax: pat, state: "in", anim: 0, mood: 0 };
}

function banner(text, col) { st.banner = { text, col }; st.bannerT = 2; }
function pop(x, y, text, col) { st.pops.push({ x, y, text, col, life: 1 }); }

function tapStation(id, x, y) {
  if (!unlocked(id)) { sfx.no(); return; }
  const s = st.stations[id], m = M[id];
  if (m.kind === "grab") {
    if (s.cd > 0) return;
    if (!toTray(id, x, y)) return;
    s.cd = 0.35; return;
  }
  if (m.kind === "roll") {
    if (s.state === "done") { if (toTray(id, x, y)) { s.state = "idle"; s.taps = 0; } return; }
    s.taps++; s.shake = 1; sfx.tap();
    if (s.taps >= m.taps) { s.state = "done"; sfx.ding(); if (toTray(id, x, y)) { s.state = "idle"; s.taps = 0; } }
    return;
  }
  if (s.state === "idle") { s.state = "cook"; s.t = 0; sfx.start(); }
  else if (s.state === "cook") { s.shake = 1; sfx.no(); }
  else if (s.state === "done") { if (toTray(id, x, y)) { s.state = "idle"; s.t = 0; } }
  else if (s.state === "burnt") { s.state = "idle"; s.t = 0; sfx.tap(); }
}

function toTray(id, x, y) {
  if (st.tray.length >= trayCap()) { sfx.no(); pop(x, y, T.full, C.red); return false; }
  st.tray.push(id); sfx.tray(); return true;
}

function tapCustomer(i, x, y) {
  const c = st.customers[i]; if (!c || c.state !== "wait") return;
  let gave = false;
  c.order.forEach((id, k) => {
    if (c.got[k]) return;
    const at = st.tray.indexOf(id);
    if (at >= 0) { st.tray.splice(at, 1); c.got[k] = true; gave = true; }
  });
  if (!gave) { sfx.no(); c.mood = 1; return; }
  sfx.tray();
  if (c.got.every(Boolean)) {                                      // 다 받았으면 계산 + 팁
    const base = c.order.reduce((a, id) => a + priceOf(M[id]), 0);
    st.combo++;
    const tip = Math.round(base * (0.5 * c.pat / c.patMax + Math.min(0.3, (st.combo - 1) * 0.05)) / 100) * 100;
    const pay = base + tip;
    st.earn += pay; st.money += pay; st.served++;
    c.state = "happy"; c.anim = 1;
    pop(x, y, `+${T.won(pay)}`, C.yellow);
    if (st.combo >= 3) pop(x, y - 26, T.combo(st.combo), C.cyan);
    sfx.pay();
  }
}

function tapTray(k) { if (st.tray[k] != null) { st.tray.splice(k, 1); sfx.tap(); } }

function endDay(boss) {
  if (st.mode !== "play") return;
  st.plays++;
  const pass = !boss && st.earn >= goalOf(st.day);
  st.result = { pass, boss, earn: st.earn, goal: goalOf(st.day), served: st.served, angry: st.angryN, day: st.day };
  if (st.earn > st.best) st.best = st.earn;
  sdk.score(st.best);
  if (window.WSA_LB) window.WSA_LB.submit(st.earn);
  if (pass) { st.day++; sfx.fanfare(); } else sfx.angry();
  st.mode = "result"; save();
}

async function nextFromResult() {
  if (st.plays > 0 && st.plays % 3 === 0) {                        // 세 판마다 전면 광고 (유튜브 안에서만)
    st.paused = true; try { await sdk.interstitial(); } catch (e) {} st.paused = false; startLoop();
  }
  startDay();
}

function buy(u) {
  const lv = st.up[u.id]; if (lv >= MAX_UP) return;
  const cost = upCost(u, lv); if (st.money < cost) { sfx.no(); return; }
  st.money -= cost; st.up[u.id]++; sfx.pay(); save();
}

// ───────────── 갱신 ─────────────
function update(dt) {
  st.t += dt;
  if (st.bannerT > 0) st.bannerT -= dt;
  st.shake = Math.max(0, st.shake - dt * 4);
  for (const p of st.pops) { p.life -= dt * 0.9; p.y -= dt * 40; }
  st.pops = st.pops.filter(p => p.life > 0);
  if (st.mode !== "play") return;
  st.time -= dt;
  for (const m of MENU) {
    const s = st.stations[m.id];
    s.shake = Math.max(0, s.shake - dt * 6); s.cd = Math.max(0, s.cd - dt);
    if (s.state === "cook") { s.t += dt; if (s.t >= cookTime(m)) { s.state = "done"; s.t = 0; sfx.ding(); } }
    else if (s.state === "done" && m.kind === "cook") { s.t += dt; if (s.t >= BURN_AFTER) { s.state = "burnt"; sfx.burn(); } }
  }
  st.customers.forEach((c, i) => {
    if (!c) return;
    c.mood = Math.max(0, c.mood - dt * 3);
    if (c.state === "in") { c.anim = Math.min(1, c.anim + dt * 3); if (c.anim >= 1) c.state = "wait"; }
    else if (c.state === "wait") {
      c.pat -= dt;
      if (c.pat <= 0) {                                             // 기다리다 지쳐 화내며 나감
        c.state = "angry"; c.anim = 1; st.angryN++; st.combo = 0; st.shake = 1; sfx.angry();
        if (st.angryN >= 3) { endDay(true); return; }
      }
    } else { c.anim -= dt * 2.2; if (c.anim <= 0) st.customers[i] = null; }
  });
  if (st.mode !== "play") return;
  st.spawnT -= dt;
  if (st.spawnT <= 0 && st.time > 5) {
    spawnCustomer();
    const iv = Math.max(1.4, 4.6 - st.day * 0.28);
    st.spawnT = iv * (0.7 + Math.random() * 0.6);
  }
  if (st.time <= 0) { st.time = 0; endDay(false); }
}

// ───────────── 화면 ─────────────
const cv = document.getElementById("c");
const cx = cv.getContext("2d");
const view = { w: 0, h: 0, dpr: 1 };
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  view.dpr = dpr; view.w = w; view.h = h;
}
window.addEventListener("resize", layout);
const R = Math.round;

function img(n) { const im = new Image(); im.src = `img/${n}.png`; return im; }
function imgOk(im) { return im && im.complete && im.naturalWidth > 0; }
const FOOD = Object.fromEntries(MENU.map(m => [m.id, img(`food_${m.id}`)]));
const STATION = Object.fromEntries(MENU.map(m => [m.id, img(`st_${m.id}`)]));
const CUST = Array.from({ length: 8 }, (_, i) => img(`cust_${i}`));
const BG = img("shop_bg");

const PIX_FONT = '"Galmuri11", "Apple SD Gothic Neo", "Noto Sans KR", monospace';
try {
  const ff = new FontFace("Galmuri11", "url(fonts/Galmuri11-Bold.woff2)");
  ff.load().then(f => document.fonts.add(f)).catch(() => {});
} catch (e) {}

function text(str, x, y, size, color, align = "center", shadow = true, maxW = 0) {
  cx.save();
  cx.font = `${Math.round(size)}px ${PIX_FONT}`;
  if (maxW) { const tw = cx.measureText(str).width; if (tw > maxW) { size = Math.floor(size * maxW / tw); cx.font = `${size}px ${PIX_FONT}`; } }
  cx.textAlign = align; cx.textBaseline = "middle";
  if (shadow) { cx.fillStyle = C.ink; const o = Math.max(2, Math.round(size / 11)); cx.fillText(str, x + o, y + o); }
  cx.fillStyle = color; cx.fillText(str, x, y); cx.restore();
}
function shade(hex, k) {                                         // k>0 밝게, k<0 어둡게
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  return `rgb(${c.map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))).join(",")})`;
}
function stepRect(g, x, y, w, h, p) {                           // 모서리를 픽셀 계단처럼 깎은 사각형
  g.fillRect(x + 2 * p, y, w - 4 * p, h);
  g.fillRect(x + p, y + p, w - 2 * p, h - 2 * p);
  g.fillRect(x, y + 2 * p, w, h - 4 * p);
}
function pixelBox(x, y, w, h, fill, edge, press = 0) {
  x = R(x); y = R(y); w = R(w); h = R(h);
  const p = Math.max(2, Math.round(Math.min(w, h) / 24)), o = Math.round(press * p * 2);
  cx.fillStyle = "#120a26"; stepRect(cx, x, y + 3 * p, w, h, p);
  cx.fillStyle = shade(edge, -0.45); stepRect(cx, x, y + o, w, h, p);
  const ix = x + p, iy = y + o + p, iw = w - 2 * p, ih = h - 2 * p;
  cx.fillStyle = shade(fill, -0.28); stepRect(cx, ix, iy, iw, ih, p);
  cx.fillStyle = fill; stepRect(cx, ix, iy, iw, ih - 2 * p, p);
  cx.fillStyle = shade(fill, 0.35); cx.fillRect(ix + 2 * p, iy + p, iw - 4 * p, Math.max(p, Math.round(ih * 0.18)));
  cx.fillStyle = "rgba(255,255,255,.9)"; cx.fillRect(ix + 2 * p, iy + p, 2 * p, p); cx.fillRect(ix + p, iy + 2 * p, p, p);
  return o;
}
function button(x, y, w, h, label, fill, edge, fn, color = "#ffffff") {
  pixelBox(x, y, w, h, fill, edge, 0);
  text(label, x + w / 2, y + h / 2, Math.round(h * 0.38), color, "center", false, w - 24);
  hit(x, y, w, h, fn);
}
function hit(x, y, w, h, fn) { st.hits.push({ x, y, w, h, fn }); }
function drawImg(im, x, y, w, h) { if (imgOk(im)) cx.drawImage(im, R(x), R(y), R(w), R(h)); }
function fitImg(im, x, y, w, h) {                               // 비율 유지하며 칸 안에 맞춤
  if (!imgOk(im)) return;
  const s = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  cx.drawImage(im, R(x + (w - dw) / 2), R(y + (h - dh) / 2), R(dw), R(dh));
}

// 게임 화면 기둥: 넓은 화면에서도 세로 휴대폰 비율로 가운데에 그린다
function col() { const W = Math.min(view.w, view.h * 0.66); return { W, X: (view.w - W) / 2, H: view.h }; }

function drawShopBg(X, W, H, bottom) {
  cx.fillStyle = "#2b1a12"; cx.fillRect(0, 0, view.w, view.h);
  if (imgOk(BG)) {
    const s = Math.max(W / BG.naturalWidth, bottom / (BG.naturalHeight * 0.5));   // 그림 속 카운터(높이 절반)를 화면 카운터에 맞춤
    const dw = BG.naturalWidth * s;
    cx.save(); cx.beginPath(); cx.rect(X, 0, W, bottom); cx.clip();
    cx.drawImage(BG, R(X + (W - dw) / 2), 0, R(dw), R(BG.naturalHeight * s));
    cx.restore();
  }
}

function drawCustomers(X, W, top, counterY) {
  const n = st.customers.length, slotW = W / n;
  const ch = Math.min(counterY - top - 60, slotW * 1.05);
  st.customers.forEach((c, i) => {
    if (!c) return;
    const cxp = X + slotW * (i + 0.5);
    const k = c.state === "in" ? 1 - Math.pow(1 - c.anim, 3) : c.state === "wait" ? 1 : c.anim;
    const hop = c.state === "happy" ? Math.abs(Math.sin(st.t * 14)) * ch * 0.08 : 0;
    const shake = c.mood > 0 || c.state === "angry" ? Math.sin(st.t * 60) * 3 : 0;
    const y = counterY - ch * k - hop + ch * 0.08;
    const im = CUST[c.look];
    cx.save(); cx.beginPath(); cx.rect(X, 0, W, counterY); cx.clip();
    if (imgOk(im)) {
      const s = ch / im.naturalHeight, dw = im.naturalWidth * s;
      cx.drawImage(im, R(cxp - dw / 2 + shake), R(y), R(dw), R(ch));
      if (c.state === "angry" || (c.state === "wait" && c.pat / c.patMax < 0.25)) {   // 화나면 빨갛게
        cx.globalCompositeOperation = "source-atop"; cx.globalAlpha = c.state === "angry" ? 0.45 : 0.18 + 0.12 * Math.sin(st.t * 10);
        cx.fillStyle = C.red; cx.fillRect(R(cxp - dw / 2 + shake), R(y), R(dw), R(ch));
        cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
      }
    }
    cx.restore();
    if (c.state === "happy") text("♥", cxp + ch * 0.32, y + ch * 0.1 - (1 - c.anim) * 30, Math.round(ch * 0.22), C.pink);
    if (c.state === "angry") text("!!", cxp + ch * 0.3, y + ch * 0.1, Math.round(ch * 0.24), C.red);
    if (c.state !== "wait" && c.state !== "in") return;
    // 주문 말풍선 + 인내심 막대
    const ic = Math.min(slotW * 0.27, 40), pad = 6, bw = c.order.length * (ic + 4) + pad * 2 - 4, bh = ic + pad * 2 + 8;
    const bx = R(cxp - bw / 2), by = R(Math.max(top + 4, y - bh - 8));
    cx.globalAlpha = k;
    cx.fillStyle = C.ink; stepRect(cx, bx - 2, by - 2, bw + 4, bh + 4, 2);
    cx.fillStyle = "#fff8ec"; stepRect(cx, bx, by, bw, bh, 2);
    cx.fillStyle = "#fff8ec"; cx.fillRect(R(cxp - 4), by + bh, 8, 5); cx.fillRect(R(cxp - 2), by + bh + 5, 4, 3);
    c.order.forEach((id, j) => {
      const ix = bx + pad + j * (ic + 4), iy = by + pad;
      cx.globalAlpha = k * (c.got[j] ? 0.3 : 1);
      fitImg(FOOD[id], ix, iy, ic, ic);
      cx.globalAlpha = k;
      if (c.got[j]) text("✓", ix + ic / 2, iy + ic / 2, Math.round(ic * 0.7), C.green, "center", true);
    });
    const r = Math.max(0, c.pat / c.patMax);
    cx.fillStyle = "#d8cfc0"; cx.fillRect(bx + pad, by + bh - pad - 4, bw - pad * 2, 5);
    cx.fillStyle = r > 0.5 ? "#3cc860" : r > 0.25 ? "#f0b020" : C.red;
    cx.fillRect(bx + pad, by + bh - pad - 4, R((bw - pad * 2) * r), 5);
    cx.globalAlpha = 1;
    hit(cxp - slotW / 2, by, slotW, counterY - by, () => tapCustomer(i, cxp, by));
  });
}

function drawCounter(X, W, y, hgt) {
  // 나무 카운터
  cx.fillStyle = "#3a2214"; cx.fillRect(R(X), R(y), R(W), R(hgt));
  cx.fillStyle = "#b8743c"; cx.fillRect(R(X), R(y), R(W), R(hgt * 0.22));
  cx.fillStyle = "#e09a58"; cx.fillRect(R(X), R(y), R(W), 3);
  cx.fillStyle = "#7a4626"; for (let i = 0; i < 6; i++) cx.fillRect(R(X + W * (i + 0.5) / 6), R(y + hgt * 0.22), 2, R(hgt * 0.78));
  // 쟁반
  const cap = trayCap(), ts = Math.min((W - 24) / cap - 6, hgt * 0.62), tw = cap * (ts + 6) - 6;
  const tx = X + (W - tw) / 2, ty = y + hgt * 0.3;
  cx.fillStyle = C.ink; stepRect(cx, R(tx - 8), R(ty - 6), R(tw + 16), R(ts + 12), 3);
  cx.fillStyle = "#c83c3c"; stepRect(cx, R(tx - 6), R(ty - 4), R(tw + 12), R(ts + 8), 3);
  for (let k = 0; k < cap; k++) {
    const sx = tx + k * (ts + 6);
    cx.fillStyle = "#e85a5a"; cx.fillRect(R(sx), R(ty), R(ts), R(ts));
    const id = st.tray[k];
    if (id) { fitImg(FOOD[id], sx + 2, ty + 2, ts - 4, ts - 4); hit(sx, ty, ts, ts, () => tapTray(k)); }
  }
}

function drawKitchen(X, W, y, H) {
  cx.fillStyle = "#4a5260"; cx.fillRect(R(X), R(y), R(W), R(H - y));
  cx.fillStyle = "#5c6676"; for (let yy = y; yy < H; yy += 18) cx.fillRect(R(X), R(yy), R(W), 1);
  const cols = 3, rows = 2, gap = 8, pad = 10;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols, chh = (H - y - pad * 2 - gap * (rows - 1) - 6) / rows;
  const cells = [...MENU.map(m => m.id), "trash"];
  cells.forEach((id, i) => {
    const c0 = i % cols, r0 = Math.floor(i / cols);
    const x = X + pad + c0 * (cw + gap), yy = y + pad + r0 * (chh + gap);
    if (id === "trash") { drawTrash(x, yy, cw, chh); return; }
    drawStation(id, x, yy, cw, chh);
  });
}

function drawStation(id, x, y, w, h) {
  const m = M[id], s = st.stations[id], open = unlocked(id);
  const warn = m.kind === "cook" && s.state === "done" && s.t > BURN_AFTER - 1.5 && Math.floor(st.t * 8) % 2 === 0;
  const edge = s.state === "done" ? (warn ? C.red : C.green) : s.state === "burnt" ? "#555555" : "#2a3040";
  cx.fillStyle = C.ink; stepRect(cx, R(x), R(y), R(w), R(h), 3);
  cx.fillStyle = edge; stepRect(cx, R(x + 2), R(y + 2), R(w - 4), R(h - 4), 3);
  cx.fillStyle = "#2e3442"; stepRect(cx, R(x + 5), R(y + 5), R(w - 10), R(h - 10), 2);
  const jig = s.shake ? Math.sin(st.t * 70) * 3 * s.shake : 0;
  const ih = h - 34, im = STATION[id];
  cx.save(); if (!open) cx.globalAlpha = 0.35;
  fitImg(im, x + 8 + jig, y + 6, w - 16, ih);
  cx.restore();
  const label = T === TEXT.ko ? m.ko : m.en;
  text(label, x + w / 2, y + h - 15, Math.round(Math.min(18, h * 0.12)), "#ffffff", "center", true, w - 12);
  if (!open) {
    cx.fillStyle = "rgba(10,8,20,.55)"; stepRect(cx, R(x + 5), R(y + 5), R(w - 10), R(h - 10), 2);
    text("🔒", x + w / 2, y + h * 0.4, Math.round(h * 0.2), "#ffffff", "center", false);
    text(T.locked(m.day), x + w / 2, y + h * 0.62, Math.round(Math.min(16, h * 0.11)), C.yellow, "center", true, w - 12);
    hit(x, y, w, h, () => tapStation(id, x + w / 2, y));
    return;
  }
  if (s.state === "cook") {                                       // 조리 중: 진행 막대 + 김
    const k = Math.min(1, s.t / cookTime(m));
    cx.fillStyle = C.ink; cx.fillRect(R(x + 10), R(y + h - 32), R(w - 20), 8);
    cx.fillStyle = "#ff9a3c"; cx.fillRect(R(x + 11), R(y + h - 31), R((w - 22) * k), 6);
    for (let i = 0; i < 3; i++) {
      const ph = (st.t * 0.9 + i / 3) % 1;
      cx.globalAlpha = 0.6 * (1 - ph); cx.fillStyle = "#ffffff";
      cx.fillRect(R(x + w * (0.35 + i * 0.15) + Math.sin(ph * 6 + i) * 4), R(y + ih * 0.5 - ph * ih * 0.5), 5, 5);
    }
    cx.globalAlpha = 1;
  } else if (s.state === "done") {                                // 완성: 음식이 통통 튀며 "완성!"
    const b = Math.abs(Math.sin(st.t * 6)) * 6, fs = Math.min(w * 0.5, ih * 0.75);
    fitImg(FOOD[id], x + w / 2 - fs / 2, y + ih * 0.5 - fs / 2 - b, fs, fs);
    text(T.done, x + w / 2, y + 14, Math.round(Math.min(16, h * 0.11)), warn ? C.red : C.green, "center", true);
  } else if (s.state === "burnt") {
    cx.fillStyle = "rgba(20,10,10,.6)"; stepRect(cx, R(x + 5), R(y + 5), R(w - 10), R(h - 10), 2);
    for (let i = 0; i < 4; i++) { const ph = (st.t * 0.7 + i / 4) % 1; cx.globalAlpha = 0.7 * (1 - ph); cx.fillStyle = "#6a6a6a"; cx.fillRect(R(x + w * (0.3 + i * 0.13)), R(y + ih * 0.7 - ph * ih * 0.6), 7, 7); }
    cx.globalAlpha = 1;
    text(T.burnt, x + w / 2, y + h * 0.36, Math.round(Math.min(18, h * 0.13)), C.red, "center", true, w - 12);
    text(T.toss, x + w / 2, y + h * 0.36 + 20, Math.round(Math.min(14, h * 0.1)), "#ffffff", "center", true, w - 12);
  } else if (m.kind === "roll") {                                // 김밥: 몇 번 말았는지 점으로
    for (let i = 0; i < m.taps; i++) {
      cx.fillStyle = i < s.taps ? C.yellow : "rgba(255,255,255,.25)";
      cx.fillRect(R(x + w / 2 + (i - (m.taps - 1) / 2) * 14 - 4), R(y + h - 34), 8, 8);
    }
  }
  hit(x, y, w, h, () => tapStation(id, x + w / 2, y));
}

function drawTrash(x, y, w, h) {
  cx.fillStyle = C.ink; stepRect(cx, R(x), R(y), R(w), R(h), 3);
  cx.fillStyle = "#2a3040"; stepRect(cx, R(x + 2), R(y + 2), R(w - 4), R(h - 4), 3);
  cx.fillStyle = "#2e3442"; stepRect(cx, R(x + 5), R(y + 5), R(w - 10), R(h - 10), 2);
  const s = Math.min(w, h) * 0.07, ox = x + w / 2 - 5 * s, oy = y + h * 0.42 - 6 * s;   // 픽셀 휴지통
  cx.fillStyle = "#9aa4b4"; cx.fillRect(R(ox), R(oy), R(10 * s), R(2 * s)); cx.fillRect(R(ox + 3.5 * s), R(oy - s), R(3 * s), R(s));
  cx.fillStyle = "#7a8494"; cx.fillRect(R(ox + s), R(oy + 3 * s), R(8 * s), R(9 * s));
  cx.fillStyle = "#5a6474"; for (let i = 0; i < 3; i++) cx.fillRect(R(ox + (2.5 + i * 2) * s), R(oy + 4.5 * s), R(s), R(6 * s));
  text(T.trash, x + w / 2, y + h - 15, Math.round(Math.min(18, h * 0.12)), "#ffffff", "center", true, w - 12);
  hit(x, y, w, h, () => { if (st.tray.length) { st.tray.pop(); sfx.tap(); } else sfx.no(); });
}

function drawHud(X, W) {
  const top = 8, bh = 34;
  cx.fillStyle = "rgba(14,10,34,.82)"; cx.fillRect(R(X), 0, R(W), top + bh + 26);
  text(T.day(st.day), X + 12, top + bh / 2, 20, C.cyan, "left");
  // 남은 시간 막대
  const tw = W * 0.36, tx = X + W / 2 - tw / 2, k = st.time / DAY_LEN;
  cx.fillStyle = C.ink; cx.fillRect(R(tx - 2), R(top + 8), R(tw + 4), 18);
  cx.fillStyle = k < 0.2 && Math.floor(st.t * 4) % 2 ? C.red : k < 0.2 ? "#ff9a3c" : C.green;
  cx.fillRect(R(tx), R(top + 10), R(tw * k), 14);
  text(T.left(Math.ceil(st.time)), X + W / 2, top + bh / 2, 15, "#ffffff", "center", true);
  text(T.won(st.earn), X + W - 12, top + bh / 2, 20, C.yellow, "right", true, W * 0.3);
  // 목표 막대 + 화난 손님 표시
  const g = goalOf(st.day), gk = Math.min(1, st.earn / g), gy = top + bh + 6, gw = W - 24 - 70;
  cx.fillStyle = C.ink; cx.fillRect(R(X + 12), R(gy), R(gw), 10);
  cx.fillStyle = gk >= 1 ? C.green : C.pink; cx.fillRect(R(X + 13), R(gy + 1), R((gw - 2) * gk), 8);
  text(`${T.goal} ${T.won(g)}`, X + 12 + gw / 2, gy + 5, 11, "#ffffff", "center", true);
  for (let i = 0; i < 3; i++) text(i < st.angryN ? "💢" : "○", X + W - 60 + i * 22, gy + 5, 15, i < st.angryN ? C.red : "rgba(255,255,255,.5)", "center", false);
}

let lbShown = null;
function draw() {
  st.hits = [];
  const lbOn = st.mode !== "play";
  if (window.WSA_LB && window.WSA_LB.showButton && lbOn !== lbShown) { lbShown = lbOn; window.WSA_LB.showButton(lbOn); }
  const { W, X, H } = col();
  cx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  cx.imageSmoothingEnabled = false;
  if (st.shake > 0) cx.translate(R(Math.sin(st.t * 80) * 4 * st.shake), 0);
  const counterY = R(H * 0.44), counterH = R(H * 0.11), kitchenY = counterY + counterH;
  drawShopBg(X, W, H, counterY + 4);
  if (st.mode === "title") { drawTitle(X, W, H); return; }
  drawCustomers(X, W, 76, counterY);
  drawCounter(X, W, counterY, counterH);
  drawKitchen(X, W, kitchenY, H);
  drawHud(X, W);
  if (st.mode === "play" && st.day === 1 && st.time > DAY_LEN - 14) {   // 첫날 사용법
    const y = counterY - 14;
    cx.fillStyle = "rgba(14,10,34,.8)"; cx.fillRect(R(X), R(y - 12), R(W), 24);
    text(T.hint, X + W / 2, y, 13, "#ffffff", "center", true, W - 16);
  }
  for (const p of st.pops) { cx.globalAlpha = Math.min(1, p.life * 1.5); text(p.text, p.x, p.y, 20, p.col, "center", true); }
  cx.globalAlpha = 1;
  if (st.banner && st.bannerT > 0) {
    cx.fillStyle = "rgba(14,10,34,.7)"; cx.fillRect(R(X), R(H * 0.3 - 24), R(W), 48);
    text(st.banner.text, X + W / 2, H * 0.3, 24, st.banner.col, "center", true, W - 24);
  }
  if (st.mode === "result") drawResult(X, W, H);
  if (st.mode === "shop") drawShop(X, W, H);
}

function signText(str, x, y, size, maxW) {                       // 간판 글씨: 입체 + 노을빛
  cx.save(); cx.font = `${size}px ${PIX_FONT}`; cx.textAlign = "center"; cx.textBaseline = "middle";
  const tw = cx.measureText(str).width; if (maxW && tw > maxW) { size = Math.floor(size * maxW / tw); cx.font = `${size}px ${PIX_FONT}`; }
  const d = Math.max(3, R(size * 0.1));
  for (let i = d; i > 0; i--) { cx.fillStyle = i === d ? C.ink : "#7a1f3a"; cx.fillText(str, x + i, y + i); }
  cx.lineWidth = Math.max(3, size * 0.1); cx.lineJoin = "round"; cx.strokeStyle = C.ink; cx.strokeText(str, x, y);
  const g = cx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, "#fff3a0"); g.addColorStop(0.5, C.yellow); g.addColorStop(1, "#ff7a3c");
  cx.fillStyle = g; cx.fillText(str, x, y); cx.restore();
}

function drawTitle(X, W, H) {
  cx.fillStyle = "rgba(14,10,34,.35)"; cx.fillRect(0, 0, view.w, H);
  const size = Math.min(W / 5.2, 76);
  signText(T.title, X + W / 2, H * 0.17, size, W - 32);
  // 대표 음식들이 통통
  const fs = Math.min(W / 5.5, 70);
  MENU.forEach((m, i) => {
    const x = X + W / 2 + (i - 2) * fs * 1.05 - fs / 2, b = Math.abs(Math.sin(st.t * 3 + i)) * 8;
    fitImg(FOOD[m.id], x, H * 0.3 - b, fs, fs);
  });
  const py = H * 0.47, pw = Math.min(W - 32, 320), px = X + (W - pw) / 2;
  cx.fillStyle = "rgba(14,10,34,.85)"; stepRect(cx, R(px), R(py), R(pw), 96, 4);
  text(T.day(st.day), X + W / 2, py + 22, 24, C.cyan, "center", true);
  text(`${T.wallet} ${T.won(st.money)}`, X + W / 2, py + 52, 17, C.yellow, "center", true, pw - 20);
  if (st.best) text(`${T.best} ${T.won(st.best)}`, X + W / 2, py + 76, 14, "#ffffff", "center", true, pw - 20);
  const bw = Math.min(W * 0.7, 280), bh = 62, bx = X + (W - bw) / 2;
  button(bx, H * 0.64, bw, bh, T.start, C.pink, "#8a1a55", () => startDay());
  button(bx + bw * 0.1, H * 0.64 + bh + 18, bw * 0.8, 48, T.shop, "#3ca0ff", "#1a4a8a", () => { st.mode = "shop"; st.shopFrom = "title"; });
  text(T.hint, X + W / 2, Math.min(H - 20, H * 0.64 + bh + 100), 12, "#ffffff", "center", true, W - 24);
}

function panel(X, W, H, ph) {
  cx.fillStyle = "rgba(8,5,20,.72)"; cx.fillRect(0, 0, view.w, H);
  const pw = Math.min(W - 24, 360), px = X + (W - pw) / 2, py = Math.max(16, (H - ph) / 2);
  cx.fillStyle = C.ink; stepRect(cx, R(px - 4), R(py - 4), R(pw + 8), R(ph + 8), 4);
  cx.fillStyle = C.cyan; stepRect(cx, R(px - 2), R(py - 2), R(pw + 4), R(ph + 4), 4);
  cx.fillStyle = "#1a1040"; stepRect(cx, R(px), R(py), R(pw), R(ph), 4);
  return { px, py, pw };
}

function drawResult(X, W, H) {
  const r = st.result, { px, py, pw } = panel(X, W, H, 330);
  text(r.boss ? T.boss : T.closed, px + pw / 2, py + 34, 28, r.boss ? C.red : C.pink, "center", true, pw - 20);
  text(T.earned, px + pw / 2, py + 76, 15, "#cfc8ff", "center", false);
  text(T.won(r.earn), px + pw / 2, py + 108, 34, C.yellow, "center", true, pw - 20);
  text(`${T.goal} ${T.won(r.goal)}`, px + pw / 2, py + 142, 14, "#ffffff", "center", false);
  text(r.pass ? T.pass : T.fail, px + pw / 2, py + 172, 22, r.pass ? C.green : C.red, "center", true);
  text(`${T.served(r.served)} · ${T.angry(r.angry)}`, px + pw / 2, py + 202, 13, "#cfc8ff", "center", false, pw - 20);
  const bw = pw - 40, bx = px + 20;
  button(bx, py + 222, bw, 52, r.pass ? `${T.next} (${T.day(st.day)})` : T.retry, C.pink, "#8a1a55", () => nextFromResult());
  button(bx + bw * 0.15, py + 284, bw * 0.7, 36, `${T.shop} · ${T.won(st.money)}`, "#3ca0ff", "#1a4a8a", () => { st.mode = "shop"; st.shopFrom = "result"; });
}

function drawShop(X, W, H) {
  const rowH = 74, ph = 70 + UPGRADES.length * rowH + 60, { px, py, pw } = panel(X, W, H, ph);
  text(T.shop, px + pw / 2, py + 26, 22, C.cyan, "center", true);
  text(`${T.wallet} ${T.won(st.money)}`, px + pw / 2, py + 54, 16, C.yellow, "center", true, pw - 20);
  UPGRADES.forEach((u, i) => {
    const y = py + 72 + i * rowH, lv = st.up[u.id], max = lv >= MAX_UP, cost = upCost(u, lv), can = !max && st.money >= cost;
    cx.fillStyle = "rgba(255,255,255,.06)"; cx.fillRect(R(px + 10), R(y), R(pw - 20), rowH - 8);
    text(T === TEXT.ko ? u.ko : u.en, px + 20, y + 18, 17, "#ffffff", "left", true, pw * 0.5);
    text(T === TEXT.ko ? u.dko : u.den, px + 20, y + 42, 12, "#cfc8ff", "left", false, pw * 0.52);
    for (let k = 0; k < MAX_UP; k++) { cx.fillStyle = k < lv ? C.yellow : "rgba(255,255,255,.2)"; cx.fillRect(R(px + 20 + k * 14), R(y + 56), 10, 6); }
    const bw = Math.min(120, pw * 0.36), bx = px + pw - 18 - bw;
    if (max) text(T.max, bx + bw / 2, y + 30, 16, C.yellow, "center", true);
    else {
      pixelBox(bx, y + 8, bw, 44, can ? C.green : "#6a6a88", can ? "#1a7a3a" : "#3a3a58", 0);
      text(T.won(cost), bx + bw / 2, y + 30, 15, can ? C.ink : "#cfc8ff", "center", false, bw - 14);
      hit(bx, y + 8, bw, 44, () => buy(u));
    }
  });
  const bw = pw * 0.6;
  button(px + (pw - bw) / 2, py + ph - 52, bw, 42, T.back, "#8a8aa8", "#3a3a58", () => { st.mode = st.shopFrom === "result" ? "result" : "title"; });
}

// ───────────── 입력 ─────────────
cv.addEventListener("pointerdown", e => {
  ensureAudio();
  if (!st.ready) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  for (let i = st.hits.length - 1; i >= 0; i--) {                 // 나중에 그린 것(위에 있는 것)부터
    const b = st.hits[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.fn(); return; }
  }
});
window.addEventListener("keydown", e => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON")) return;
  if ((e.key === "Enter" || e.key === " ") && (st.mode === "title" || st.mode === "result")) { e.preventDefault(); st.mode === "title" ? startDay() : nextFromResult(); }
});

// ───────────── 루프 ─────────────
let last = 0, rafId = 0, firstFrame = false;
function frame(now) {
  rafId = 0;
  if (st.paused) return;
  { const d = Math.min(window.devicePixelRatio || 1, 2.5); if (Math.abs(cv.width - Math.round((cv.clientWidth || innerWidth) * d)) > 2) layout(); }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  update(dt); draw();
  if (!firstFrame) { firstFrame = true; sdk.firstFrameReady(); }
  rafId = requestAnimationFrame(frame);
}
function startLoop() { if (!rafId) { last = 0; rafId = requestAnimationFrame(frame); } }

(async function boot() {
  layout(); resetStations(); startLoop();
  const lang = (await sdk.lang() || "").toLowerCase();
  T = lang.startsWith("ko") ? TEXT.ko : TEXT.en;
  document.title = T.title;
  window.WSA_LB_UNIT = T === TEXT.ko ? "원" : " won";
  window.WSA_LB_IMG = () => "img/food_tteok.png";
  audioEnabled = sdk.audioOn();
  await loadSave();
  st.ready = true;
  sdk.gameReady();
  if (IN_YT) {
    YT.system.onPause(() => { st.paused = true; if (actx) actx.suspend(); save(); });
    YT.system.onResume(() => { st.paused = false; if (actx && audioEnabled) actx.resume(); startLoop(); });
    YT.system.onAudioEnabledChange(on => setAudio(on));
  }
})();
