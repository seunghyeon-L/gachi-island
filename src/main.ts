// 섬 Phaser 테스트 화면 시작점. 팀 FE develop 의 game/src/main.ts 와 같은 방식:
// 캔버스는 기기 픽셀 크기로 만들고 CSS 로 화면 크기에 맞춤(도트가 번지지 않게), pixelArt.
// roundPixels 는 끔 — Phaser 3.90 은 위치를 '그림 픽셀' 단위로 내림해서, 확대하면 귤새·드래그가 몇 px 씩 툭툭 뜀(11/17 "고치 움직임이 끊겨").
// 대신 장면(scene.ts snap)에서 위치를 화면(기기) 픽셀 단위로 맞춤.
// PC 에서도 폰처럼 보이게 기기 픽셀 배율은 최소 3배 (예전 게임 화면과 같음).
import Phaser from 'phaser';

import { loadData, state, STAGE_IDS, type StageId } from './data';
import { IslandScene } from './scene';
import { HS, HUD, initOverlay, layoutOverlay, openPet, PS, setOnGrown, startGrowthPanel } from './overlay';

// assets/ 의 JSON(화면 설정·애니메이션·섬·화산재 시간표)을 먼저 다 읽고 시작
const D = await loadData();

const DEVICES = [
  { key: '390,844', label: 'iPhone 14/15 (390×844)' },
  { key: '480,844', label: '넓게 보기 (480×844)' },
  { key: '375,812', label: 'iPhone 11 Pro (375×812)' },
  { key: '430,932', label: 'iPhone Pro Max (430×932)' },
  { key: '360,780', label: '안드로이드 (360×780)' },
];
const view = { device: DEVICES[0].key, fit: true };

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const stageEl = $('#stage');
const phone = $('#phone');

function sizes() {
  const [w, h] = view.device.split(',').map(Number);
  const aw = stageEl.clientWidth - 24 || w;
  const ah = stageEl.clientHeight - 24 || h;
  const css = view.fit ? Math.min(aw / w, ah / h) : 1;
  const dpr = Math.max(3, Math.min(4, window.devicePixelRatio || 1));
  return { w, h, css: css > 0 ? css : 1, dpr };
}

const s0 = sizes();
const scene = new IslandScene(D);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#35b9b6',
  pixelArt: true,
  roundPixels: false,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.NONE, width: Math.round(s0.w * s0.css * s0.dpr), height: Math.round(s0.h * s0.css * s0.dpr), zoom: 1 / s0.dpr },
  scene: [scene],
});
(window as unknown as { __game?: Phaser.Game }).__game = game;

function layout() {
  const s = sizes();
  phone.style.width = s.w * s.css + 'px';
  phone.style.height = s.h * s.css + 'px';
  game.scale.setZoom(1 / s.dpr);
  game.scale.resize(Math.round(s.w * s.css * s.dpr), Math.round(s.h * s.css * s.dpr));
  layoutOverlay(s.w, s.h, s.css * s.dpr); // 창 연출 덮개 (예전 게임 화면 그리기 코드, css px 기준)
}
window.addEventListener('resize', layout);
layout();

// ───── 사이드바 ─────
type Item = { key: string; label: string };
function chips(host: HTMLElement, items: Item[], cur: string, pick: (k: string) => void) {
  host.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = it.label;
    b.setAttribute('aria-pressed', String(it.key === cur));
    b.onclick = () => {
      pick(it.key);
      render();
    };
    host.appendChild(b);
  }
}

function render() {
  const S = D.screen;
  chips($('#design'), Object.entries(D.designs).map(([key, d]) => ({ key, label: d.label })), state.design, (k) => {
    state.design = k;
    scene.buildIsland();
    scene.resetView();
  });
  chips($('#sea'), S.seas, state.sea, (k) => scene.setSea(k));
  chips(
    $('#surf'),
    [
      { key: '10', label: '10차 그대로 옮김 — 넓은 얇은 물 + 레이스 거품 (색만 새 모래·새 바다에 맞춤)' },
      { key: 'lap', label: '잔잔한 물가 — 밝은 얕은 띠 · 찰랑이는 짧은 선 · 물가선이 살금살금 (인스타 SpriteCook 분석)' },
      { key: 'lapfoam', label: '잔잔한 물가 + 흰 거품 조금 — 물가선을 타고 작은 흰 거품이 띄엄띄엄' },
      { key: 'off', label: '해안 파도 끔' },
    ],
    state.surf,
    (k) => (state.surf = k),
  );
  chips(
    $('#view'),
    [
      { key: 'reset', label: '처음 화면 (한라산 가까이)' },
      { key: 'all', label: '섬 전체 보기' },
    ],
    '',
    (k) => (k === 'all' ? scene.fitAll() : scene.resetView()),
  );
  chips($('#isle-stage'), [{ key: '0', label: '넓히기 전 (작은 섬)' }, { key: '1', label: '넓힌 뒤' }], String(state.stage), (k) => {
    state.stage = +k;
    scene.buildIsland();
  });
  chips(
    $('#grass-corner'),
    [{ key: 'made', label: '만든 버전 (옆 조각 테두리를 이어 붙임)' }, { key: 'orig', label: '원래대로 (가운데 조각 그대로)' }],
    state.grassCorner,
    (k) => {
      state.grassCorner = k as 'made' | 'orig';
      scene.buildIsland();
    },
  );
  chips(
    $('#expand'),
    [{ key: 'full', label: scene.EX.on ? '… 연출 중' : '▶ 화면 전체 가리기 — 작은 섬 → 분출 → 화산재가 화면을 다 덮음 → 걷히면 넓어진 섬' }],
    '',
    () => scene.startExpand(),
  );
  chips(
    $('#panic'),
    [
      { key: '0', label: '혼비백산 A — 알 통통 허둥 · 어린 새 파닥 콩콩 · 성체 날개 허우적' },
      { key: '1', label: '혼비백산 B — 알 뒤뚱 허둥 · 어린 새 만세 종종 · 성체 다리 빙빙(로드러너)' },
    ],
    String(state.panicVer),
    (k) => (state.panicVer = +k),
  );
  chips($('#panic-only'), [{ key: 'go', label: scene.PO.on ? '… 혼비백산 중' : '▶ 혼비백산만 4초 보기 (분출 없이)' }], '', () => scene.startPanicOnly());
  chips($('#volc-rest'), S.volcano.filter((a) => a.kind === 'rest'), state.volcRest, (k) => scene.volcSet(k));
  chips($('#volc-erupt'), S.volcano.filter((a) => a.kind === 'erupt').map((a) => ({ key: a.key, label: '▶ ' + a.label })), scene.erupting ?? '', (k) =>
    scene.erupt(k),
  );
  chips($('#wander-stage'), STAGE_IDS.map((s) => ({ key: s, label: S.stages[s].label })), state.wander, (k) => {
    state.wander = k as StageId;
    state.wanderAnim = 'auto';
    scene.wanderReset();
  });
  const st = S.stages[state.wander];
  const auto = st.anims.find((a) => a.key === st.auto)!;
  chips(
    $('#wander-anim'),
    [{ key: 'auto', label: `자동 — 쉬다(가만히) ${auto.label.split(' (')[0]}로 이동` }, ...st.anims.map((a) => ({ key: a.key, label: a.label }))],
    state.wanderAnim,
    (k) => {
      state.wanderAnim = k;
      scene.onAnimChange();
    },
  );
  chips($('#row-on'), [{ key: '1', label: '보이기' }, { key: '0', label: '숨기기' }], state.rowOn ? '1' : '0', (k) => (state.rowOn = k === '1'));
  const rows = $('#rows');
  rows.innerHTML = '';
  for (const s of STAGE_IDS) {
    const h = document.createElement('div');
    h.className = 'note';
    h.textContent = S.stages[s].label;
    const list = document.createElement('div');
    list.className = 'list';
    rows.append(h, list);
    chips(list, S.stages[s].anims.filter((a) => a.kind !== 'flight'), state.row[s], (k) => scene.setRow(s, k));
  }
  if (overlayReady) {
    chips($('#grow-where'), [{ key: 'panel', label: '성장 창 (앱 growth-reveal 자리)' }, { key: 'island', label: '섬에서 (돌아다니던 고치가 그 자리에서)' }], state.hatchWhere,
      (k) => (state.hatchWhere = k as 'panel' | 'island'));
    const grow = (k: string) => (state.hatchWhere === 'island' ? scene.startHatchIsland(k) : startGrowthPanel(k));
    const of = (kind: 'hatch' | 'grow', pre: string) => S.growth.filter((g) => g.kind === kind).map((g) => ({ key: g.key, label: pre + g.label }));
    chips($('#hatch'), of('hatch', '부화 '), HS.on ? HS.h.key : '', grow);
    chips($('#grow'), of('grow', '자라기 '), HS.on ? HS.h.key : '', grow);
    chips($('#pet-stage'), STAGE_IDS.map((s2) => ({ key: s2, label: S.stages[s2].label })), state.petStage, (k) => (state.petStage = k as StageId));
    chips($('#pet'), [{ key: 'open', label: '쓰담 창 열기 (마우스로 문지르기)' }, { key: 'a', label: 'A 손에 기대 비비기 — 반복 보기' }, { key: 'b', label: 'B 손 뗄 때 폴짝 — 1회 보기' }],
      PS.on ? (PS.mode === 'hold' ? 'a' : PS.mode === 'happy' ? 'b' : 'open') : '', (k) => openPet(k, state.petStage));
  }
  chips($('#device'), DEVICES, view.device, (k) => {
    view.device = k;
    layout();
  });
  chips($('#fit'), [{ key: 'fit', label: '세로 꽉 채움' }, { key: 'real', label: '실제 크기' }], view.fit ? 'fit' : 'real', (k) => {
    view.fit = k === 'fit';
    layout();
  });
  chips($('#speed'), [{ key: '0.5', label: '×½' }, { key: '1', label: '×1' }, { key: '2', label: '×2' }], String(state.speed), (k) => (state.speed = +k));
  chips(
    $('#etc'),
    [
      { key: 'shadow', label: '그림자 ' + (state.shadow ? '켬' : '끔') },
      { key: 'hud', label: '앱 화면 요소 ' + (HUD.show ? '켬' : '끔') },
      { key: 'debug', label: '걷는 칸·격자 ' + (state.debug ? '켬' : '끔') },
      { key: 'pause', label: state.paused ? '▶ 다시 재생' : '❚❚ 멈춤' },
    ],
    '',
    (k) => {
      if (k === 'shadow') state.shadow = !state.shadow;
      if (k === 'hud') HUD.show = !HUD.show;
      if (k === 'debug') state.debug = !state.debug;
      if (k === 'pause') state.paused = !state.paused;
    },
  );
}

let overlayReady = false;
scene.onReady = () => {
  render();
  scene.onTick = render;
  initOverlay(phone, render, D);
  overlayReady = true;
  setOnGrown((to: StageId) => {
    state.wander = to;
    state.wanderAnim = 'auto';
    scene.wanderReset();
  });
  layout();
  render();
};
setInterval(() => {
  if (scene.W.player) {
    $('#status').textContent = scene.status();
    const c = scene.caption();
    $('#caption').textContent = c;
    $('#caption').style.display = c ? 'block' : 'none';
  }
}, 200);
