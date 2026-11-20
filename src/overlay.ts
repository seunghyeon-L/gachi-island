// @ts-nocheck — 예전 캔버스 게임 화면(비공개 저장소의 도구로 만든 한 파일 화면)의 그리기 코드를 거의 그대로 옮김
// 창으로 뜨는 연출: 성장 창(부화·자라기) · 쓰담쓰담 · 앱 화면 요소(경험치 바·아이콘·활동 버튼)
// (보상 팡파레 · 탐험 보상 알은 11/20 사용자 요청으로 뺌)
// Phaser 캔버스 위에 같은 크기 2D 캔버스를 겹쳐 그림. 좌표는 예전과 같은 css px(DEV) · K = 캔버스 px / css px.
// 그림은 Phaser 장면과 같은 애니메이션 파일(assets/animations/<폴더>/sheet.png)을 그대로 씀.
import { shadowUrl, sheetUrl, state } from './data';
import { Player } from './player';

let cv, ctx, D, DEV = { w: 390, h: 844, top: 47, bottom: 34 }, K = 1;
let onChange = () => {};
const img = (src) => { if (!src) return null; const i = new Image(); i.src = src; return i; };
// 애니메이션 id → { body, shadow } 그림 (한 번만 읽음)
const IMG = new Map();
const imgsOf = (a) => { let m = IMG.get(a.id); if (!m) { m = { body: img(sheetUrl(a)), shadow: img(shadowUrl(a)) }; IMG.set(a.id, m); } return m; };
const UIIMG = {};
/** t(ms) 지났을 때 몇 번 장인지 (1회 재생, 끝 장에서 멈춤) */
const frameAt = (a, t) => { let acc = 0; for (let i = 0; i < a.frameCount; i++) { acc += a.durationsMs[i]; if (t < acc) return i; } return a.frameCount - 1; };

export const HS = { on: false, h: null, p: null, after: 0 };   // 성장 창
export const PS = { on: false, stage: 'juvenile', mode: 'idle', p: null, strokes: 0, path: 0, completed: false, last: null,
                    fx: [], glow: 0, holdMs: 0, clock: 0, lastHeart: -1e9 };
export const HUD = { show: true, fab: false, menu: false, sound: true, toast: '', toastLeft: 0, coins: 128, xp: 0.45 };

export function initOverlay(phone, change, data) {
  onChange = change;
  D = data;
  for (const g of D.screen.growth) imgsOf(D.anims[g.anim]);
  for (const st in D.screen.pet) { imgsOf(D.anims[D.screen.pet[st].hold]); imgsOf(D.anims[D.screen.pet[st].happy]); }
  for (const k of D.screen.petFx) imgsOf(D.anims[k]);
  for (const k in D.screen.ui) UIIMG[k] = img(D.screen.ui[k]);
  cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated';
  phone.appendChild(cv);
  ctx = cv.getContext('2d');
  // 앱 화면 요소 누르기 · 창 닫기 — 지도 끌기(Phaser)보다 먼저 받음
  const block = (e) => {
    const pt = devPoint(e);
    if (PS.on || HS.on) return;                        // 창이 떠 있을 땐 덮개 캔버스가 직접 받음
    if (hudHit(pt)) { e.stopPropagation(); e.preventDefault(); if (e.type === 'pointerdown') { hudClick(pt); onChange(); } }
  };
  for (const t of ['pointerdown', 'mousedown', 'touchstart']) phone.addEventListener(t, block, { capture: true, passive: false });
  cv.addEventListener('pointerdown', (e) => {
    const pt = devPoint(e);
    if (HS.on) { if (HS.p.done) { finishPanel(); } return; }
    if (!PS.on) return;
    const g = petGeom();
    if (pt.x < g.px || pt.x > g.px + g.pw || pt.y < g.py || pt.y > g.py + g.ph) { PS.on = false; onChange(); return; }
    if (Math.abs(pt.x - g.ax) <= g.area / 2 && Math.abs(pt.y - g.ay) <= g.area / 2) {
      try { cv.setPointerCapture(e.pointerId); } catch (_) {} PS.last = pt; PS.path = 0; PS.completed = false; petMode('hold');
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!PS.on || PS.mode !== 'hold' || !PS.last) return;
    const pt = devPoint(e); PS.path += Math.hypot(pt.x - PS.last.x, pt.y - PS.last.y); PS.last = pt;
    if (PS.path >= scale(36)) { PS.path = 0; petStroke(); }                    // 앱: 36pt 문지를 때마다 쓰담 1번
  });
  cv.addEventListener('pointerup', () => {
    if (!PS.on || PS.mode !== 'hold') return;
    PS.last = null; petMode(PS.completed ? 'happy' : 'release');
  });
  let last = performance.now();
  const tick = (now) => {
    const dt = state.paused ? 0 : Math.min(now - last, 250) * state.speed; last = now;
    step(dt); draw();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 화면 크기 (main.ts layout 이 부름) */
export function layoutOverlay(w, h, k) {
  DEV = { w, h, top: 47, bottom: 34 }; K = k;
  if (!cv) return;
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  cache = new Map(); fxCache.clear(); uiCache.clear();
}

const devPoint = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * DEV.w / r.width, y: (e.clientY - r.top) * DEV.h / r.height }; };
const factor = () => Math.min(Math.max(DEV.w / 390, 0.8), 1.15);
const scale = (n) => Math.round(n * factor() * 2) / 2;
const R = (v) => Math.round(v * K);
let cache = new Map();
function scaled(a, which, f, outW, outH, flip) {
  const key = `${a.id}|${which}|${f}|${outW}|${outH}|${flip}`;
  let c = cache.get(key); if (c) return c;
  const im = imgsOf(a)[which];
  if (!im || !im.complete) return null;
  c = document.createElement('canvas'); c.width = outW; c.height = outH;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (flip) { x.translate(outW, 0); x.scale(-1, 1); }
  const w = a.frameWidth, h = a.frameHeight;
  x.drawImage(im, f * w, 0, w, h, 0, 0, outW, outH);
  cache.set(key, c); return c;
}
const fxCache = new Map();
function fxFrame(k, f, dw, dh) {
  const key = `${k}|${f}|${dw}|${dh}`; let c = fxCache.get(key); if (c) return c;
  const m = D.anims[k], im = imgsOf(m).body; if (!im.complete) return null;
  c = document.createElement('canvas'); c.width = dw; c.height = dh;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, f * m.frameWidth, 0, m.frameWidth, m.frameHeight, 0, 0, dw, dh);
  fxCache.set(key, c); return c;
}
const uiCache = new Map();
function uiImg(k, dw, dh) {
  const key = `${k}|${dw}|${dh}`; let c = uiCache.get(key); if (c) return c;
  const im = UIIMG[k]; if (!im || !im.complete) return null;
  c = document.createElement('canvas'); c.width = dw; c.height = dh;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, dw, dh);
  uiCache.set(key, c); return c;
}

// ───── 흐름 ─────
function step(dt) {
  if (HS.on) { HS.p.step(dt); if (HS.p.done) HS.after += dt; }
  if (PS.on) stepPet(dt);
  cv.style.pointerEvents = PS.on || HS.on ? 'auto' : 'none';
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = false;
  drawHud();
  if (HS.on) drawGrowthPanel();
  if (PS.on) drawPetPanel();
}

// ───── 성장 창 (앱 growth-reveal.tsx) ─────
export function startGrowthPanel(key) {
  const h = D.screen.growth.find((x) => x.key === key);
  HS.h = h; HS.p = new Player(D.anims[h.anim], false); HS.on = true; HS.after = 0; onChange();
}
let onGrown = null;
export function setOnGrown(fn) { onGrown = fn; }
function finishPanel() { HS.on = false; onGrown && onGrown(HS.h.to); onChange(); }
function wrapText(text, maxW) {
  const out = []; let line = '';
  for (const ch of text) { if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch; }
  if (line) out.push(line); return out;
}
function drawGrowthPanel() {
  const f = factor(), pad = scale(16), gap = scale(10), sp = scale(96);
  const pw = Math.min(scale(320), DEV.w - scale(24) * 2), px = (DEV.w - pw) / 2;
  ctx.font = `${R(13 * f)}px "Pretendard", "Malgun Gothic", sans-serif`;
  const body = wrapText(HS.h.body, R(pw - pad * 2));
  const ph = pad + sp + gap + 20 * f + gap + body.length * 18 * f + gap + 14 * f + gap + scale(44) + pad;
  const py = (DEV.h - ph) / 2;
  ctx.fillStyle = 'rgba(26,21,32,0.72)'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#1A1520'; ctx.fillRect(R(px), R(py), R(pw), R(ph));
  const bw = R(3 * f);
  ctx.fillStyle = '#FFF8EC'; ctx.fillRect(R(px) + bw, R(py) + bw, R(pw) - bw * 2, R(ph) - bw * 2);
  const p = HS.p, a = p.a;
  const c = scaled(a, 'body', p.f, R(sp), R(sp), false), sh = a.shadow ? scaled(a, 'shadow', p.f, R(sp), R(sp), false) : null;
  const sx = R(DEV.w / 2) - Math.round(R(sp) / 2), sy = R(py + pad);
  if (sh && state.shadow) ctx.drawImage(sh, sx, sy);
  if (c) ctx.drawImage(c, sx, sy);
  let y = py + pad + sp + gap;
  const text = (t, size, color, weight = '') => {
    ctx.font = `${weight} ${R(size * f)}px "Pretendard", "Malgun Gothic", sans-serif`; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(t, R(DEV.w / 2), R(y));
  };
  const done = p.done;
  text(done ? HS.h.title : '…!', 20, '#1A1520', '700'); y += 20 * f + gap;
  ctx.font = `${R(13 * f)}px "Pretendard", "Malgun Gothic", sans-serif`;
  for (const ln of body) { text(done ? ln : '', 13, '#6E6875'); y += 18 * f; }
  y += gap; text(HS.h.lv, 12, '#3a8f3e'); y += 14 * f + gap;
  const bx = px + pad, bwid = pw - pad * 2, bh = scale(44);
  ctx.fillStyle = '#1A1520'; ctx.fillRect(R(bx), R(y), R(bwid), R(bh));
  ctx.fillStyle = done ? '#ffd27a' : '#e6dccb'; ctx.fillRect(R(bx) + bw, R(y) + bw, R(bwid) - bw * 2, R(bh) - bw * 2);
  y += (bh - 15 * f) / 2; text('계속하기', 15, '#1A1520', '700');
  ctx.textAlign = 'start';
}

// ───── 쓰담쓰담 (앱 pet-creature) ─────
export function openPet(how, stage) {
  if (stage) PS.stage = stage;
  PS.on = true; PS.strokes = 0; PS.path = 0; PS.completed = false; PS.fx = [];
  if (how === 'a') petMode('hold'); else if (how === 'b') petMode('happy'); else petMode('idle');
  onChange();
}
function petMode(m) {
  // 쓰담: hold = 누르는 동안 반복 · happy = 손 뗄 때 1회 · release = 3번 못 채우고 뗌(hold 끝 장) · idle = hold 0번 장
  PS.mode = m; const pet = D.screen.pet[PS.stage], hold = D.anims[pet.hold], happy = D.anims[pet.happy];
  PS.p = m === 'hold' ? new Player(hold, true) : m === 'happy' ? new Player(happy, false)
       : m === 'release' ? Object.assign(new Player(hold, false), { f: hold.frameCount - 1 }) : new Player(hold, false);
  if (m === 'idle') PS.p.done = true;
}
function stepPet(dt) {
  if (PS.mode !== 'idle') PS.p.step(dt);
  if ((PS.mode === 'happy' || PS.mode === 'release') && PS.p.done) petMode('idle');
  PS.glow += ((PS.mode === 'hold' ? 1 : 0) - PS.glow) * Math.min(1, dt / 120);
  PS.clock += dt;
  for (const e of PS.fx) e.t += dt;
  PS.fx = PS.fx.filter((e) => e.t < D.anims[e.k].lifetimeMs);
}
function petGeom() {
  const f = factor(), pad = scale(12), gap = scale(10), area = scale(168), dot = scale(18), chipH = scale(5) * 2 + 12 * f + scale(2) * 2;
  const pw = Math.min(scale(320), DEV.w - scale(24) * 2), px = (DEV.w - pw) / 2;
  const ph = pad + 11 * f + gap + area + scale(2) + dot + scale(8) + chipH + pad;
  const py = (DEV.h - ph) / 2;
  return { f, pad, gap, area, dot, chipH, pw, px, ph, py, ax: DEV.w / 2, ay: py + pad + 11 * f + gap + area / 2 };
}
const HEART_GAP = 450;
function petStroke() {
  const love = PS.fx.some((e) => e.k === 'pet-love'), hearts = PS.fx.filter((e) => e.k !== 'pet-love').length;
  PS.strokes++;
  if (PS.strokes >= 3) { PS.strokes = 0; PS.completed = true; if (!love) PS.fx.push({ k: 'pet-love', t: 0 }); return; }
  if (!love && hearts < 2 && PS.clock - PS.lastHeart >= HEART_GAP) {
    PS.fx.push({ k: ['pet-heart-l', 'pet-heart', 'pet-heart-r'][Math.floor(Math.random() * 3)], t: 0 });
    PS.lastHeart = PS.clock;
  }
}
function drawPetFx(ax, ay, layer) {
  const px = scale(72) / 32;
  for (const e of PS.fx) {
    if ((e.k === 'pet-love') !== (layer === 'back')) continue;
    const m = D.anims[e.k], f = frameAt(m, e.t), w = m.frameWidth, h = m.frameHeight;
    const dw = R(w * px), dh = R(h * px), c = fxFrame(e.k, f, dw, dh); if (!c) continue;
    const oy = e.k === 'pet-love' ? ay + 6 * px : ay + scale(10);
    ctx.drawImage(c, R(ax) - Math.round(m.pivot[0] * dw / w), R(oy) - Math.round(m.pivot[1] * dh / h));
  }
}
function drawPetPanel() {
  const g = petGeom(), { f, pad, gap, area, dot, chipH, pw, px, ph, py } = g, bw = R(3 * f);
  ctx.fillStyle = 'rgba(26,21,32,0.72)'; ctx.fillRect(0, 0, cv.width, cv.height);
  const rect = (x, y, w, h, fill, b) => { ctx.fillStyle = '#1A1520'; ctx.fillRect(R(x), R(y), R(w), R(h)); ctx.fillStyle = fill; ctx.fillRect(R(x) + b, R(y) + b, R(w) - b * 2, R(h) - b * 2); };
  rect(px, py, pw, ph, '#FFF8EC', bw);
  let y = py + pad;
  const text = (t, size, color, weight = '', cx = DEV.w / 2) => {
    ctx.font = `${weight} ${R(size * f)}px "Pretendard", "Malgun Gothic", sans-serif`; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(t, R(cx), R(y));
  };
  text('쓰담쓰담', 11, '#6E6875'); y += 11 * f + gap;
  const ax = g.ax, ay = g.ay;
  const gs = scale(108) * (0.9 + 0.18 * PS.glow);
  ctx.globalAlpha = 0.2 + 0.5 * PS.glow; rect(ax - gs / 2, ay - gs / 2, gs, gs, '#E6D1A1', bw); ctx.globalAlpha = 1;
  const a = PS.p.a, sp = R(scale(72));
  const c = scaled(a, 'body', PS.p.f, sp, sp, false);
  const ly = Math.round(PS.p.lift() * sp / 32);
  drawPetFx(ax, ay, 'back');
  if (c) ctx.drawImage(c, R(ax) - Math.round(sp / 2), R(ay) - Math.round(sp / 2) + ly);
  drawPetFx(ax, ay, 'front');
  y += area + scale(2);
  for (let i = 0; i < 3; i++) {
    const cx = DEV.w / 2 + (i - 1) * (dot + scale(8));
    ctx.fillStyle = '#1A1520'; ctx.beginPath(); ctx.arc(R(cx), R(y + dot / 2), R(dot / 2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = i < PS.strokes ? '#FF8A3D' : '#FFFDF8'; ctx.beginPath(); ctx.arc(R(cx), R(y + dot / 2), R(dot / 2) - R(2 * f), 0, Math.PI * 2); ctx.fill();
  }
  y += dot + scale(8);
  const label = PS.mode === 'hold' ? (PS.strokes === 0 ? '쓰담쓰담 중…' : `쓰담 ${PS.strokes}/3!`) : (PS.strokes === 0 ? '손가락으로 쓰담쓰담 해주세요' : `쓰담 ${PS.strokes}/3`);
  ctx.font = `800 ${R(12 * f)}px "Pretendard", "Malgun Gothic", sans-serif`;
  const lw = ctx.measureText(label).width / K + scale(12) * 2 + scale(2) * 2;
  rect(DEV.w / 2 - lw / 2, y, lw, chipH, PS.mode === 'hold' ? '#E6D1A1' : '#FFFDF8', R(2 * f));
  y += scale(2) + scale(5); text(label, 12, '#1A1520', '800');
  ctx.textAlign = 'start';
}

// ───── 앱 홈 화면 요소 (home-top-bar · resource-header · home-activity-toggle 값 그대로) ─────
const MENU_CLOSE = ['X...X', '.X.X.', '..X..', '.X.X.', 'X...X'];
const MENU_RESET = ['.X.....', 'XXXXX..', '.X...X.', '......X', 'X.....X', 'X.....X', '.X...X.', '..XXX..'];
function hudGeom() {
  const top = DEV.top + scale(8), side = scale(14), icon = scale(42), gap = scale(6);
  const barW = scale(208), barH = barW / 8;
  const icons = ['icon-menu', 'icon-shop', 'icon-book'].map((k, i) => ({ k, x: DEV.w - side - icon, y: top + i * (icon + gap), s: icon, label: ['메뉴', '상점', '도감'][i] }));
  const bottom = Math.max(DEV.bottom, scale(12)), area = scale(160), ax = DEV.w - scale(12) - area, ay = DEV.h - bottom - area;
  const fab = { k: 'fab-open', x: DEV.w - scale(12) - scale(76), y: DEV.h - bottom - scale(76), s: scale(76), label: HUD.fab ? '활동 닫기' : '활동 열기' };
  const acts = [['icon-walk', '걷기', 4, 96], ['icon-bongging', '봉그깅', 31, 31], ['icon-local-shop', '로컬 상점', 96, 4]]
    .map(([k, label, t, l]) => ({ k, label, x: ax + scale(l), y: ay + scale(t), s: scale(52) }));
  const mx = icons[0].x - gap, my = top, close = { k: 'close', x: mx - scale(22), y: my, s: scale(22), label: '메뉴 닫기' };
  const menu = [close, ...[['icon-profile', '프로필'], ['icon-settings', '설정'], ['icon-sound', '소리']].map(([k, label], i) =>
    ({ k, label, x: mx - icon, y: my + scale(22) + gap + i * (icon + gap), s: icon })),
    { k: 'reset', label: '데이터 초기화', x: mx - icon, y: my + scale(22) + gap + 3 * (icon + gap), s: icon }];
  return { top, side, icon, barW, barH, icons, fab, acts, menu };
}
function drawnFrame(x, y, size, border, bottom, pattern, cell, color) {
  ctx.fillStyle = '#6B5A3E'; ctx.fillRect(R(x), R(y), R(size), R(size));
  ctx.fillStyle = '#D9C49B'; ctx.fillRect(R(x + border), R(y + border), R(size - border * 2), R(size - border - bottom));
  const pw = pattern[0].length * cell, ph = pattern.length * cell, ox = x + (size - pw) / 2, oy = y + border + (size - border - bottom - ph) / 2;
  ctx.fillStyle = color;
  pattern.forEach((row, j) => [...row].forEach((m, i) => { if (m === 'X') ctx.fillRect(R(ox + i * cell), R(oy + j * cell), Math.ceil(R(cell)), Math.ceil(R(cell))); }));
}
function drawHud() {
  if (!HUD.show || !D) return;
  const g = hudGeom(), f = factor();
  const put = (k, x, y, w, h) => { const c = uiImg(k, R(w), R(h)); if (c) ctx.drawImage(c, R(x), R(y)); };
  const by = g.top + (g.icon - g.barH) / 2;
  put('xp-bar-empty', g.side, by, g.barW, g.barH);
  const full = uiImg('xp-bar-full', R(g.barW), R(g.barH));
  if (full) { const fw = Math.round(R(g.barW) * HUD.xp); if (fw > 0) ctx.drawImage(full, 0, 0, fw, full.height, R(g.side), R(by), fw, full.height); }
  const cy = g.top + g.icon + scale(2);
  put('icon-tangerine', g.side, cy, scale(18), scale(18));
  ctx.font = `${R(11 * f)}px "Pretendard", "Malgun Gothic", sans-serif`; ctx.fillStyle = '#1A1520'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(String(HUD.coins), R(g.side + scale(18) + scale(4)), R(cy + scale(9)));
  for (const it of g.icons) put(it.k, it.x, it.y, it.s, it.s);
  if (HUD.fab) for (const it of g.acts) put(it.k, it.x, it.y, it.s, it.s);
  if (HUD.menu) {
    for (const it of g.menu) {
      if (it.k === 'close') drawnFrame(it.x, it.y, it.s, scale(2), scale(3), MENU_CLOSE, scale(2), '#6B5A3E');
      else if (it.k === 'reset') drawnFrame(it.x, it.y, it.s, scale(2), scale(4), MENU_RESET, scale(3), '#8B7355');
      else { ctx.globalAlpha = it.k === 'icon-sound' && !HUD.sound ? 0.4 : 1; put(it.k, it.x, it.y, it.s, it.s); ctx.globalAlpha = 1; }
    }
    const m = g.icons[0]; ctx.fillStyle = '#FF8A3D'; ctx.fillRect(R(m.x + m.s / 2 - scale(2.5)), R(m.y + m.s), R(scale(5)), R(scale(5)));
  }
  put(g.fab.k, g.fab.x, g.fab.y, g.fab.s, g.fab.s);
  if (HUD.toast && performance.now() < HUD.toastLeft) {
    ctx.font = `700 ${R(13 * f)}px "Pretendard", "Malgun Gothic", sans-serif`;
    const tw = ctx.measureText(HUD.toast).width + R(scale(28)), th = R(scale(34)), tx = R(DEV.w / 2) - tw / 2, ty = R(DEV.h * 0.16);
    ctx.fillStyle = 'rgba(26,21,32,0.82)'; ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = '#FFF8EC'; ctx.textAlign = 'center'; ctx.fillText(HUD.toast, R(DEV.w / 2), ty + th / 2);
  }
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function hudHit(pt) {
  if (!HUD.show || !D) return false;
  const g = hudGeom(), hit = (it) => pt.x >= it.x && pt.x <= it.x + it.s && pt.y >= it.y && pt.y <= it.y + it.s;
  if (HUD.menu) return true;
  return [g.icons[0], g.fab, ...g.icons, ...(HUD.fab ? g.acts : [])].some(hit);
}
function hudClick(pt) {
  const g = hudGeom(), hit = (it) => pt.x >= it.x && pt.x <= it.x + it.s && pt.y >= it.y && pt.y <= it.y + it.s;
  if (HUD.menu) {
    const it = g.menu.find(hit);
    HUD.menu = false;
    if (it && it.k === 'icon-sound') { HUD.sound = !HUD.sound; HUD.menu = true; HUD.toast = HUD.sound ? '소리 켜짐' : '소리 꺼짐'; HUD.toastLeft = performance.now() + 1200; }
    else if (it && it.k !== 'close') { HUD.toast = it.k === 'reset' ? '데이터 초기화 — 앱에서는 확인 창이 떠요' : `${it.label} — 준비 중이에요`; HUD.toastLeft = performance.now() + 1600; }
    return true;
  }
  if (hit(g.icons[0])) { HUD.menu = true; HUD.fab = false; return true; }
  if (hit(g.fab)) { HUD.fab = !HUD.fab; return true; }
  for (const it of [...g.icons, ...(HUD.fab ? g.acts : [])])
    if (hit(it)) { HUD.toast = `${it.label} — 앱에서는 ${it.label} 화면으로 (미리보기에는 없음)`; HUD.toastLeft = performance.now() + 1600; if (HUD.fab && g.acts.includes(it)) HUD.fab = false; return true; }
  return false;
}
