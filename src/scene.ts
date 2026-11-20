// 섬 장면 — 팀 FE develop 의 game/src/scene.ts 처럼 Phaser 로 그림. 다만 섬은 우리 방식(디자이너 조각 그대로),
// 바다는 디자이너 새 바다(11/17)를 우리 물결 방식으로, 귤새·화산은 우리 확정 동작.
// 좌표 = 그림 픽셀(1타일 = 32). 7차 제주 섬은 34×17 칸 세계 → 카메라로 확대·축소(휠·두 손가락)·드래그.
import Phaser from 'phaser';

import { shadowUrl, sheetUrl, state, STAGE_IDS, type Anim, type AnimDef, type Data, type Design, type IslandStage, type StageId } from './data';
import { Player } from './player';

const T = 32;
const VIEW_TILES = 11; // 처음 화면: 가로로 약 11칸이 보이게 (예전 9칸 화면과 비슷한 크기), 한라산 가운데
const MIN_TILES_ACROSS = 4; // 가장 크게 확대했을 때 가로 칸 수

type Actor = { body: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Sprite };
type Pt = { x: number; y: number };
type Mode = 'rest' | 'move' | 'takeoff' | 'fly' | 'land' | 'hatch';
type PanicActor = {
  stage: StageId; x: number; y: number; kind: 'walk' | 'row'; R: number; home: Pt; facing: number; target: Pt | null; retarget: number;
  sweatIn: number; bangIn: number; fx: { k: string; pl: Player }[]; delay: number; mode: 'startle' | 'run'; wantFacing: number;
  player: Player; src: string; boost: number;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// 해안 파도 셰이더: iChannel0 = 지도(R = 그림 열 u, G = 줄, A = 그리는 칸), iChannel1 = 32장을 가로로 이은 그림(열 수 cols × 32장, 높이 32)
const SURF_FRAG = `
precision highp float; // 폰 mediump(16비트)로는 4096칸 그림의 칸 위치가 어긋남
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float frame;
uniform vec2 mapScale;
uniform float cols;
varying vec2 outTexCoord;
void main() {
  // Phaser 셰이더의 outTexCoord 는 아래가 0 → 위아래 뒤집어 읽음. 지도는 2의 거듭제곱 크기로 채워져 있어 쓰는 범위만큼 줄임
  vec4 m = texture2D(iChannel0, vec2(outTexCoord.x, 1.0 - outTexCoord.y) * mapScale);
  if (m.a < 0.5) discard;
  float u = floor(m.r * 255.0 + 0.5);
  float row = floor(m.g * 255.0 + 0.5);
  vec4 c = texture2D(iChannel1, vec2((frame * cols + u + 0.5) / (cols * 32.0), (row + 0.5) / 32.0));
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb, 1.0);
}`;
const SURF_SHADER = new Phaser.Display.BaseShader('surf10', SURF_FRAG, undefined, { frame: { type: '1f', value: 0 }, cols: { type: '1f', value: 32 }, mapScale: { type: '2f', value: { x: 1, y: 1 } } });

export class IslandScene extends Phaser.Scene {
  D!: Data;
  private sea!: Phaser.GameObjects.TileSprite;
  private seaP: Player | null = null;
  private surfSh: Phaser.GameObjects.Shader | null = null;
  private surfKey = '';
  private surfT = 0;
  private islandTex: Phaser.Textures.DynamicTexture | null = null;
  private islandImg: Phaser.GameObjects.Image | null = null;
  private volc!: Phaser.GameObjects.Sprite;
  private volcP: Player | null = null;
  private volcKey = '';
  erupting: string | null = null;
  private rowActors = {} as Record<StageId, Actor>;
  private rowP = {} as Record<StageId, Player>;
  private wActor!: Actor;
  W = { x: 0, y: 0, facing: 1, mode: 'rest' as Mode, restLeft: 1000, target: null as Pt | null, player: null as unknown as Player };
  private dbg!: Phaser.GameObjects.Graphics;
  onTick: (() => void) | null = null;
  onReady: (() => void) | null = null;
  // 카메라: zoomRaw 는 손가락·휠로 바뀌는 값, 실제 배율은 타일이 기기 픽셀 정수가 되게 맞춤
  private zoomRaw = 1;
  private cx = 0;
  private cy = 0;
  private pinch: { d: number; z: number } | null = null;

  /** D = data.ts loadData() 로 미리 읽은 JSON 전부 (main.ts 가 넘김) */
  constructor(D: Data) {
    super('island');
    this.D = D;
  }

  preload() {
    const D = this.D;
    this.load.spritesheet('tiles', D.screen.tiles, { frameWidth: T, frameHeight: T });
    // 애니메이션 하나 = Phaser 텍스처 id(몸) + id-shadow(그림자). 시트는 가로 한 줄, 칸 = frameWidth × frameHeight
    for (const [id, a] of Object.entries(D.anims)) {
      const size = { frameWidth: a.frameWidth, frameHeight: a.frameHeight };
      this.load.spritesheet(id, sheetUrl(a), size);
      const sh = shadowUrl(a);
      if (sh) this.load.spritesheet(id + '-shadow', sh, size);
    }
    for (const d of Object.values(D.designs))
      for (const e of Object.values(d.surf ?? {}).flat()) {
        this.load.image(e.map, `surf/${e.map}.png`);
        this.load.image(e.atlas, `surf/${e.atlas}.png`);
      }
  }

  create() {
    this.cameras.main.setRoundPixels(false); // pixelArt 가 자동으로 켜는 '그림 픽셀 단위 내림'을 끔 — 위치는 snap() 으로 기기 픽셀에 맞춤
    state.design = state.design in this.D.designs ? state.design : this.D.screen.defaultDesign;
    this.sea = this.add.tileSprite(0, 0, T, T, 'sea').setOrigin(0).setDepth(-10);
    this.setSea(state.sea);
    this.volc = this.add.sprite(0, 0, 'volcano').setOrigin(0, 1);
    const actor = (): Actor => ({ shadow: this.add.sprite(0, 0, 'gyulsae-adult-idle-shadow'), body: this.add.sprite(0, 0, 'gyulsae-adult-idle') });
    for (const s of STAGE_IDS) {
      this.rowActors[s] = actor();
      this.setRow(s, state.row[s]);
    }
    this.wActor = actor();
    this.dbg = this.add.graphics().setDepth(1e6);
    this.buildIsland();
    this.volcSet(state.volcRest);
    this.resetView();
    this.setupInput();
    this.scale.on('resize', () => this.applyCamera());
    (window as unknown as { __scene?: IslandScene }).__scene = this;
    this.onReady?.();
  }

  // ───── 섬: 칸마다 고른 조각을 한 장에 찍어 둠 — 타일 사이 틈이 생기지 않게 ─────
  design(): Design {
    return this.D.designs[state.design];
  }

  island(): IslandStage {
    return this.design().stages[state.stage];
  }

  buildIsland() {
    const [gw, gh] = this.design().grid;
    if (!this.islandTex || this.islandTex.width !== gw * T || this.islandTex.height !== gh * T) {
      this.islandImg?.destroy();
      if (this.islandTex) this.textures.remove('island');
      this.islandTex = this.textures.addDynamicTexture('island', gw * T, gh * T)!;
      this.islandImg = this.add.image(0, 0, 'island').setOrigin(0).setDepth(-5);
    }
    const st = this.island();
    const tex = this.islandTex;
    tex.clear();
    const stamp = (layer: number[][]) =>
      layer.forEach((row, r) => row.forEach((i, c) => i >= 0 && tex.drawFrame('tiles', i, c * T, r * T)));
    stamp(st.sand);
    stamp(st.grass[state.grassCorner]);
    for (const [c, r, i] of st.props) tex.drawFrame('tiles', i, c * T, r * T);
    this.wanderReset();
  }

  // ───── 바다: 한 장을 화면 전체에 반복(TileSprite), 물결 동작이면 32장 × 110ms ─────
  setSea(key: string) {
    state.sea = key;
    const a = this.D.anims[key];
    this.seaP = a ? new Player(a) : null;
    this.sea.setTexture(key, 0);
  }

  // ───── 카메라: 확대·축소·드래그 ─────
  private zoomRange() {
    const [gw, gh] = this.design().grid;
    const Wd = this.scale.width;
    const Hd = this.scale.height;
    const min = Math.min(Wd / (gw * T), Hd / (gh * T)); // 세계 전체가 보이는 배율
    const max = Wd / (MIN_TILES_ACROSS * T);
    return { min: Math.min(min, max), max };
  }

  /** 처음 화면: 가로 약 11칸 (9×20 세로 섬이면 예전처럼 격자 전체), 한라산(화산)이 가운데 */
  resetView() {
    const d = this.design();
    const [gw, gh] = d.grid;
    const Wd = this.scale.width;
    const Hd = this.scale.height;
    const tall = gh > gw;
    this.zoomRaw = tall ? Math.min(Wd / (gw * T), Hd / (gh * T)) : Wd / (VIEW_TILES * T);
    const [vc, vr] = d.volcano.cell;
    this.cx = tall ? (gw * T) / 2 : (vc + d.volcano.size[0] / 2) * T;
    this.cy = tall ? (gh * T) / 2 : (vr + 2) * T;
    this.applyCamera();
  }

  /** 섬 전체 보기 */
  fitAll() {
    const [gw, gh] = this.design().grid;
    this.zoomRaw = this.zoomRange().min;
    this.cx = (gw * T) / 2;
    this.cy = (gh * T) / 2;
    this.applyCamera();
  }

  zoom() {
    return this.cameras.main.zoom;
  }

  /** 세계 좌표를 화면(기기) 픽셀 칸에 맞춤 — 움직이는 그림의 왼쪽 위가 늘 화면 정수 자리 → 도트 폭이 안 바뀌고 1 기기 픽셀씩 매끄럽게 */
  snap(v: number) {
    const z = this.zoom();
    return Math.round(v * z) / z;
  }

  private applyCamera() {
    const cam = this.cameras.main;
    const Wd = this.scale.width;
    const Hd = this.scale.height;
    const { min, max } = this.zoomRange();
    this.zoomRaw = Phaser.Math.Clamp(this.zoomRaw, min, max);
    const z = Math.max(1, Math.round(this.zoomRaw * T)) / T; // 타일 = 기기 픽셀 정수 (도트 폭 고르게)
    const [gw, gh] = this.design().grid;
    const vw = Wd / z;
    const vh = Hd / z;
    const W = gw * T;
    const H = gh * T;
    // 세계 밖으로 너무 나가지 않게: 화면이 세계보다 작으면 세계 안(1칸 여유), 크면 가운데
    if (!this.EX.on) {
      this.cx = vw >= W ? W / 2 : Phaser.Math.Clamp(this.cx, vw / 2 - T, W - vw / 2 + T);
      this.cy = vh >= H ? H / 2 : Phaser.Math.Clamp(this.cy, vh / 2 - T, H - vh / 2 + T);
    }
    cam.setZoom(z);
    // Phaser 카메라: 화면 x = (세계 x - scrollX - W/2)·zoom + W/2 → 화면 가운데 = 세계 (scrollX + W/2)
    // 화면 x = (세계 x - scrollX - W/2)·z + W/2 → 세계 정수·z 정수 배(타일 = 기기 픽셀 정수)인 것들이 화면 정수 자리에 오게 scroll 을 맞춤
    const qx = Math.round((this.cx - Wd / 2 + Wd / 2) * z - Wd / 2);
    const qy = Math.round((this.cy - Hd / 2 + Hd / 2) * z - Hd / 2);
    cam.setScroll((qx + Wd / 2) / z - Wd / 2, (qy + Hd / 2) / z - Hd / 2);
    // 바다는 보이는 곳 전체 (32 의 배수에서 시작 → 무늬가 격자에 맞음)
    const left = Math.floor((this.cx - vw / 2) / T) * T - T;
    const top = Math.floor((this.cy - vh / 2) / T) * T - T;
    const right = Math.ceil((this.cx + vw / 2) / T) * T + T;
    const bottom = Math.ceil((this.cy + vh / 2) / T) * T + T;
    this.sea.setPosition(left, top).setSize(right - left, bottom - top).setTilePosition(0, 0);
  }

  /** 화면 점(sx, sy)을 고정한 채 배율 바꾸기 (휠·두 손가락) */
  private zoomAt(sx: number, sy: number, zRaw: number) {
    const Wd = this.scale.width;
    const Hd = this.scale.height;
    const z0 = this.zoom();
    const wx = this.cx + (sx - Wd / 2) / z0;
    const wy = this.cy + (sy - Hd / 2) / z0;
    this.zoomRaw = zRaw;
    const { min, max } = this.zoomRange();
    const z1 = Math.max(1, Math.round(Phaser.Math.Clamp(zRaw, min, max) * T)) / T;
    this.cx = wx - (sx - Wd / 2) / z1;
    this.cy = wy - (sy - Hd / 2) / z1;
    this.applyCamera();
  }

  private setupInput() {
    this.input.addPointer(1); // 두 손가락
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.EX.on) return;
      this.zoomAt(p.x, p.y, this.zoomRaw * Math.pow(1.0015, -dy));
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.EX.on) return;
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (!this.pinch) this.pinch = { d, z: this.zoomRaw };
        else this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (this.pinch.z * d) / Math.max(1, this.pinch.d));
        return;
      }
      if (!p.isDown || this.pinch) return;
      const z = this.zoom();
      this.cx -= (p.x - p.prevPosition.x) / z;
      this.cy -= (p.y - p.prevPosition.y) / z;
      this.applyCamera();
    });
    this.input.on('pointerup', () => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) this.pinch = null;
    });
  }

  // ───── 섬 넓히기 — 화면 전체 가리기 (MOTIONS 30장 시간표 그대로) ─────
  // 흔들림 → 분출 → 화산재가 화면을 덮음 → 다 덮인 동안 넓힌 섬으로 바꿈 → 화산 자리부터 걷힘.
  // 시간표의 덩이 자리는 옛 섬 화산 칸 기준 → 지금 섬 화산 칸만큼 옮겨 그림. 연출하는 동안 카메라는 시간표가 덮는 범위(box) 안에 고정.
  EX = { on: false, t: 0, swapped: false, volc: false };
  private ashPool: Phaser.GameObjects.Sprite[] = [];
  private ashSolid: Phaser.GameObjects.Rectangle | null = null;
  private toastUntil = 0;

  private ashOffset(): [number, number] {
    const A = this.D.ash;
    const [vc, vr] = this.design().volcano.cell;
    return [(vc - A.origin[0]) * T, (vr - A.origin[1]) * T];
  }

  startExpand() {
    const A = this.D.ash;
    if (this.EX.on) return;
    state.stage = 0;
    this.buildIsland(); // 작은 섬에서 시작
    const [ox, oy] = this.ashOffset();
    const [x0, y0, x1, y1] = A.box;
    this.EX = { on: true, t: 0, swapped: false, volc: false };
    this.zoomRaw = Math.ceil(Math.max(this.scale.width / (x1 - x0), this.scale.height / (y1 - y0)) * T) / T;
    this.cx = ox + (x0 + x1) / 2;
    this.cy = oy + (y0 + y1) / 2;
    this.applyCamera();
    this.panicStart(); // 고치들 혼비백산
    this.onTick?.();
  }

  private stepExpand(dt: number) {
    const A = this.D.ash;
    const E = this.EX;
    E.t += dt;
    if (!E.volc && E.t >= (A.volcano_start_ms || 0)) {
      E.volc = true;
      this.erupt(A.volcano);
    }
    if (!E.swapped && E.t >= A.swap_ms) {
      E.swapped = true; // 다 덮인 동안 넓힌 섬으로 (재가 가려 안 보임)
      state.stage = 1;
      this.buildIsland();
      this.panicStop(); // 다 덮였을 때 고치들은 제자리 · 평소 동작으로
      this.onTick?.();
    }
    if (E.t >= A.phases.done) {
      E.on = false;
      for (const s of this.ashPool) s.setVisible(false);
      this.ashSolid?.setVisible(false);
      this.toastUntil = performance.now() + 2400;
      this.applyCamera();
      this.onTick?.();
      return;
    }
    // 이 장의 덩이들
    let acc = 0;
    let i = A.ms.length - 1;
    for (let k = 0; k < A.ms.length; k++) {
      acc += A.ms[k];
      if (E.t < acc) {
        i = k;
        break;
      }
    }
    const [ox, oy] = this.ashOffset();
    const items = A.frames[i] || [];
    while (this.ashPool.length < items.length) this.ashPool.push(this.add.sprite(0, 0, items[0][0]).setOrigin(0).setVisible(false));
    items.forEach(([name, f, x, y], k) => {
      const s = this.ashPool[k];
      if (s.texture.key !== name) s.setTexture(name);
      s.setFrame(f).setPosition(this.snap(ox + x), this.snap(oy + y)).setDepth(1e5 + k * 0.001).setVisible(true);
    });
    for (let k = items.length; k < this.ashPool.length; k++) this.ashPool[k].setVisible(false);
    // 다 덮인 동안 화면 가장자리(시간표 범위 밖)는 재 몸 색으로
    const solid = A.solid && E.t >= A.solid.from_ms && E.t < A.solid.to_ms;
    if (solid && !this.ashSolid) this.ashSolid = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.HexStringToColor(A.solid!.color).color).setOrigin(0).setDepth(1e5 - 1);
    if (this.ashSolid) {
      const z = this.zoom();
      const vw = this.scale.width / z;
      const vh = this.scale.height / z;
      this.ashSolid.setVisible(!!solid).setPosition(this.cx - vw / 2 - T, this.cy - vh / 2 - T).setSize(vw + 2 * T, vh + 2 * T);
    }
  }

  /** 앱 아래 안내판 자리 문구 (제안) */
  caption() {
    if (this.EX.on) {
      const P = this.D.ash.phases;
      const t = this.EX.t;
      return t < P.erupt ? '화산이 흔들려요…' : t < P.covered ? '화산이 터졌어요! 화산재가 몰려와요…' : t < P.clear ? '섬이 넓어지는 중…' : '화산재가 걷혀요…';
    }
    return performance.now() < this.toastUntil ? '새 땅이 생겼어요!' : '';
  }

  // ───── 화산 (3×2 칸 자리, 동작 그림 3×4 의 아래 3×2 가 자리에 맞게) ─────
  volcSet(key: string) {
    if (!this.D.anims[key]) return;
    state.volcRest = key;
    this.erupting = null;
    this.volcKey = key;
    this.volcP = new Player(this.D.anims[key]);
  }

  erupt(key: string) {
    if (!this.D.anims[key]) return;
    this.erupting = key;
    this.volcKey = key;
    this.volcP = new Player(this.D.anims[key], false);
  }

  private volcRect() {
    const [c, r] = this.design().volcano.cell;
    const [vw, vh] = this.design().volcano.size;
    return { x0: c * T, y0: r * T, x1: (c + vw) * T, y1: (r + vh) * T };
  }

  private crossesVolc(a: Pt, b: Pt) {
    const q = this.volcRect();
    for (let i = 0; i <= 20; i++) {
      const x = a.x + ((b.x - a.x) * i) / 20;
      const y = a.y + ((b.y - a.y) * i) / 20;
      if (x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1) return true;
    }
    return false;
  }

  // ───── 가운데 줄 귤새 (제자리 재생) ─────
  anim(stage: StageId, key: string): AnimDef {
    const st = this.D.screen.stages[stage];
    return st.anims.find((a) => a.key === key) ?? st.anims[0];
  }

  setRow(stage: StageId, key: string) {
    state.row[stage] = key;
    this.rowP[stage] = new Player(this.D.anims[this.anim(stage, key).src]);
  }

  // ───── 돌아다니는 귤새 (게임 화면과 같은 규칙: 쉬기 1.6~4.2초 → 네 지점 중 다른 곳으로 이동 → 쉬기) ─────
  private curAnim() {
    const st = this.D.screen.stages[state.wander];
    return this.anim(state.wander, state.wanderAnim === 'auto' ? st.auto : state.wanderAnim);
  }

  private restAnim() {
    const st = this.D.screen.stages[state.wander];
    const a = this.curAnim();
    return state.wanderAnim !== 'auto' && a.kind === 'idle' ? a : this.anim(state.wander, st.rest);
  }

  walkPoints(): Pt[] {
    const st = this.island();
    const near = (fx: number, fy: number) =>
      st.walk.reduce((b, c) => (Math.hypot(c[0] - fx, c[1] - fy) < Math.hypot(b[0] - fx, b[1] - fy) ? c : b));
    return st.walk_targets.map(([x, y]) => near(x, y)).map(([c, r]) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T }));
  }

  wanderReset() {
    const p = this.walkPoints()[0];
    Object.assign(this.W, { x: p.x, y: p.y, facing: 1, target: null });
    this.startRest(rand(600, 1400));
  }

  onAnimChange() {
    const a = this.curAnim();
    if (a.kind === 'idle') return this.startRest(1e9);
    if (this.W.mode === 'move' && a.kind === 'move') {
      this.W.player = new Player(this.D.anims[a.src]);
      return;
    }
    this.startRest(rand(300, 700));
  }

  private startRest(ms?: number) {
    this.W.mode = 'rest';
    this.W.restLeft = ms ?? rand(1600, 4200);
    this.W.player = new Player(this.D.anims[this.restAnim().src]);
  }

  private pickTarget() {
    const W = this.W;
    const all = this.walkPoints();
    const pts = all.filter((c) => !this.crossesVolc(W, c));
    const pool = pts.length ? pts : all;
    let next = pool[Math.floor(Math.random() * pool.length)];
    for (let i = 0; i < 4; i++) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (Math.hypot(c.x - W.x, c.y - W.y) > 18) {
        next = c;
        break;
      }
    }
    return next;
  }

  private startMove() {
    const a = this.curAnim();
    const W = this.W;
    if (a.kind === 'idle') return this.startRest(1e9);
    W.target = this.pickTarget();
    if (Math.hypot(W.target.x - W.x, W.target.y - W.y) < 8) return this.startRest();
    W.facing = W.target.x >= W.x ? 1 : -1;
    if (a.kind === 'flight') {
      W.mode = 'takeoff';
      W.player = new Player(this.D.anims[a.takeoff!], false);
    } else {
      W.mode = 'move';
      W.player = new Player(this.D.anims[a.src]);
    }
  }

  private advance(dist: number) {
    const W = this.W;
    const t = W.target!;
    const dx = t.x - W.x;
    const dy = t.y - W.y;
    const d = Math.hypot(dx, dy);
    if (d <= dist) {
      W.x = t.x;
      W.y = t.y;
      return true;
    }
    W.x += (dx / d) * dist;
    W.y += (dy / d) * dist;
    return false;
  }

  private updateWander(dt: number) {
    const W = this.W;
    const a = this.curAnim();
    if (W.mode === 'hatch') {
      W.player.step(dt);
      if (W.player.done && this.hatch) {
        this.hatch.after += dt;
        if (this.hatch.after > 700) { // 끝나면 다음 단계로 (앱도 성장 창을 닫으면 다음 단계)
          state.wander = this.hatch.to;
          this.hatch = null;
          this.startRest();
          this.onTick?.();
        }
      }
      return;
    }
    if (W.mode === 'rest') {
      W.player.step(dt);
      if (W.restLeft < 1e8) {
        W.restLeft -= dt;
        if (W.restLeft <= 0) this.startMove();
      }
    } else if (W.mode === 'move') {
      if (this.advance(W.player.step(dt))) this.startRest();
    } else if (W.mode === 'takeoff') {
      this.advance(W.player.step(dt));
      if (W.player.done) {
        W.mode = 'fly';
        W.player = new Player(this.D.anims[a.src]);
      }
    } else if (W.mode === 'fly') {
      this.advance(W.player.step(dt));
      const land = this.D.anims[a.land!];
      const landDist = land.motionPx.reduce((x, y) => x + y, 0);
      if (Math.hypot(W.target!.x - W.x, W.target!.y - W.y) <= landDist + 0.5 && W.player.f === W.player.a.frameCount - 1) {
        W.mode = 'land';
        W.player = new Player(land, false);
      }
    } else if (W.mode === 'land') {
      this.advance(W.player.step(dt));
      if (W.player.done) this.startRest();
    }
  }

  private wanderSrc() {
    const a = this.curAnim();
    const m = this.W.mode;
    if (m === 'hatch' && this.hatch) return this.hatch.name;
    return m === 'rest' ? this.restAnim().src : m === 'takeoff' ? a.takeoff! : m === 'land' ? a.land! : a.src;
  }

  // ───── 고치 혼비백산 (MOTIONS 30장 — 예전 게임 화면 stepPanic 그대로) ─────
  // 깜짝(1회, "!" 말풍선) → 자기 자리 둘레를 방향을 자주 바꾸며 빠르게 달림 + 땀방울. 돌아다니는 고치 1 + 가운데 줄 고치 3
  PN: PanicActor[] = [];
  PO = { on: false, t: 0 };
  private pnPool: { actor: Actor; fx: Phaser.GameObjects.Sprite[] }[] = [];

  private runSrc(stage: StageId) {
    const r = this.D.screen.panic.stages[stage]?.panic ?? [];
    if (r.length) return { src: r[Math.min(state.panicVer, r.length - 1)], boost: 1 };
    const st = this.D.screen.stages[stage];
    const a = st.anims.find((x) => x.kind === 'move') ?? this.anim(stage, st.rest);
    return { src: a.src, boost: 2 }; // 달리기 그림이 없으면 평소 이동 동작을 2배로
  }

  panicStart() {
    this.PN = [];
    const actors: Pick<PanicActor, 'stage' | 'x' | 'y' | 'kind' | 'R'>[] = [{ stage: state.wander, x: this.W.x, y: this.W.y, kind: 'walk', R: 2.2 * T }];
    if (state.rowOn)
      STAGE_IDS.forEach((st, i) => {
        const [c, r] = this.design().rows[i];
        actors.push({ stage: st, x: (c + 0.5) * T, y: (r + 0.5) * T, kind: 'row', R: (st === 'egg' ? 0.9 : 1.5) * T });
      });
    for (const a of actors) {
      const su = this.D.screen.panic.stages[a.stage]?.startle?.[0];
      const p: PanicActor = {
        ...a, home: { x: a.x, y: a.y }, facing: Math.random() < 0.5 ? -1 : 1, target: null, retarget: 0, sweatIn: rand(350, 700),
        bangIn: su ? 130 : 0, fx: [], delay: rand(0, 160), mode: su ? 'startle' : 'run', wantFacing: 0,
        player: null as unknown as Player, src: '', boost: 1,
      };
      if (su) {
        p.player = new Player(this.D.anims[su], false);
        p.src = su;
      } else {
        const r = this.runSrc(a.stage);
        p.player = new Player(this.D.anims[r.src]);
        p.src = r.src;
        p.boost = r.boost;
      }
      this.PN.push(p);
    }
  }

  panicStop() {
    this.PN = [];
    this.hidePanic();
    this.wanderReset();
  }

  startPanicOnly() {
    if (this.EX.on) return;
    this.PO = { on: true, t: 0 };
    this.panicStart();
    this.onTick?.();
  }

  private panicTarget(p: PanicActor) {
    const st = this.island();
    const cells = st.walk.concat(this.design().rows).map(([c, r]) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T }));
    for (let k = 0; k < 12; k++) {
      const w = cells.filter((q) => Math.hypot(q.x - p.home.x, q.y - p.home.y) <= p.R);
      if (!w.length) return { ...p.home };
      const q = w[Math.floor(Math.random() * w.length)];
      const x = q.x + rand(-0.3, 0.3) * T;
      const y = q.y + rand(-0.3, 0.3) * T;
      if (this.crossesVolc(p, { x, y })) continue;
      if (Math.hypot(x - p.x, y - p.y) > T * 0.6) return { x, y };
    }
    return { ...p.home };
  }

  private stepPanic(dt: number) {
    for (const p of this.PN) {
      for (const f of p.fx) f.pl.step(dt);
      p.fx = p.fx.filter((f) => !f.pl.done);
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.bangIn -= dt;
      if (p.bangIn <= 0 && !p.fx.some((f) => f.k === 'fx-panic-bang')) {
        p.fx.push({ k: 'fx-panic-bang', pl: new Player(this.D.anims['fx-panic-bang'], false) });
        p.bangIn = rand(1600, 3200);
      }
      if (p.mode === 'startle') {
        p.player.step(dt);
        if (p.player.done) {
          const r = this.runSrc(p.stage);
          p.mode = 'run';
          p.player = new Player(this.D.anims[r.src]);
          p.src = r.src;
          p.boost = r.boost;
        }
        continue;
      }
      if (!p.target || p.retarget <= 0) {
        p.target = this.panicTarget(p);
        p.retarget = rand(350, 900);
        const nf = p.target.x >= p.x ? 1 : -1;
        if (nf !== p.facing) p.wantFacing = nf; // 방향은 다음 장부터 (걸음 박자는 그대로)
      }
      p.retarget -= dt;
      const f0 = p.player.f;
      let d = p.player.step(dt * p.boost);
      if (p.wantFacing && p.player.f !== f0) {
        p.facing = p.wantFacing;
        p.wantFacing = 0;
      }
      if (!(d > 0)) d = (dt / 1000) * 2.4 * T; // 이동 거리 없는 동작이면 초당 2.4타일
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const L = Math.hypot(dx, dy);
      if (L <= d) {
        p.x = p.target.x;
        p.y = p.target.y;
        p.retarget = 0;
      } else {
        p.x += (dx / L) * d;
        p.y += (dy / L) * d;
      }
      p.sweatIn -= dt;
      if (p.sweatIn <= 0) {
        p.sweatIn = rand(450, 900);
        p.fx.push({ k: 'fx-panic-sweat', pl: new Player(this.D.anims['fx-panic-sweat'], false) });
      }
    }
  }

  private drawPanic() {
    while (this.pnPool.length < this.PN.length)
      this.pnPool.push({ actor: { shadow: this.add.sprite(0, 0, 'fx-panic-bang'), body: this.add.sprite(0, 0, 'fx-panic-bang') }, fx: [] });
    this.PN.forEach((p, i) => {
      const slot = this.pnPool[i];
      this.put(slot.actor, p.src, p.player, p.x, p.y, p.facing);
      const lift = p.player.lift();
      const gx = this.snap(p.x - 16);
      const gy = this.snap(p.y - 16 + lift);
      while (slot.fx.length < p.fx.length) slot.fx.push(this.add.sprite(0, 0, 'fx-panic-bang').setOrigin(0));
      p.fx.forEach((f, k) => {
        const a = this.D.anims[f.k];
        // 붙일 자리(screen.json panic.attach) = 고치 그림 왼쪽 위 기준, 이펙트 기준점 = anim.json pivot
        const at = this.D.screen.panic.attach[p.stage]?.[f.k] ?? [16, 0];
        const pv = a.pivot ?? [a.frameWidth / 2, a.frameHeight / 2];
        const flip = p.facing < 0 && f.k !== 'fx-panic-bang'; // "!" 는 좌우 같음, 땀은 뒤쪽으로 튀게 같이 뒤집음
        const ax = p.facing < 0 ? 32 - at[0] : at[0];
        const fx = flip ? a.frameWidth - pv[0] : pv[0];
        const s = slot.fx[k];
        if (s.texture.key !== f.k) s.setTexture(f.k);
        s.setFrame(f.pl.f).setFlipX(flip).setPosition(gx + ax - fx, gy + at[1] - pv[1]).setDepth(p.y + 16.5).setVisible(true);
      });
      for (let k = p.fx.length; k < slot.fx.length; k++) slot.fx[k].setVisible(false);
    });
    for (let i = this.PN.length; i < this.pnPool.length; i++) this.hideSlot(this.pnPool[i]);
  }

  private hideSlot(slot: { actor: Actor; fx: Phaser.GameObjects.Sprite[] }) {
    slot.actor.body.setVisible(false);
    slot.actor.shadow.setVisible(false);
    for (const s of slot.fx) s.setVisible(false);
  }

  private hidePanic() {
    for (const slot of this.pnPool) this.hideSlot(slot);
  }

  // ───── 섬에서 부화·자라기 (MOTIONS 17 · 19장 — 예전 게임 화면 '섬에서') ─────
  private hatch: { name: string; to: StageId; after: number } | null = null;

  startHatchIsland(key: string) {
    // 성장 연출(screen.json growth): anim = 재생할 애니메이션, frm → to = 앞 단계 → 다음 단계
    const g = this.D.screen.growth.find((x) => x.key === key);
    if (!g) return;
    const { anim: name, frm, to } = g;
    state.wander = frm;
    state.wanderAnim = 'auto';
    this.W.mode = 'hatch';
    this.W.player = new Player(this.D.anims[name], false);
    this.W.facing = 1;
    this.W.target = null;
    this.hatch = { name, to, after: 0 };
    this.onTick?.();
  }

  // ───── 그리기 ─────
  private put(actor: Actor, name: string, p: Player, x: number, y: number, facing: number, visible = true) {
    const s: Anim = this.D.anims[name];
    const w = s.frameWidth;
    const h = s.frameHeight;
    const { body, shadow } = actor;
    body.setVisible(visible);
    if (body.texture.key !== name) body.setTexture(name);
    const bx = this.snap(x - w / 2) + w / 2;
    body.setFrame(p.f).setFlipX(facing < 0).setPosition(bx, this.snap(y + p.lift() - h / 2) + h / 2).setDepth(y + h / 2);
    const sh = visible && state.shadow && s.shadow;
    shadow.setVisible(sh);
    if (sh) {
      if (shadow.texture.key !== name + '-shadow') shadow.setTexture(name + '-shadow');
      shadow.setFrame(p.f).setFlipX(facing < 0).setPosition(bx, this.snap(y - h / 2) + h / 2).setDepth(y + h / 2 - 0.5);
    }
  }

  update(_now: number, delta: number) {
    const dt = state.paused ? 0 : Math.min(delta, 250) * state.speed;
    // 바다 물결 (32장 × 110ms)
    if (this.seaP) {
      const f0 = this.seaP.f;
      this.seaP.step(dt);
      if (this.seaP.f !== f0) this.sea.setFrame(this.seaP.f);
    }
    // 해안 파도 (32장 × 110ms, 섬 위에 덮는 층 — 디자이너 모래 그림은 그대로)
    // 장마다 큰 그림을 바꿔 끼우던 1차(그래픽 메모리 184MB)를 셰이더로: 지도(칸마다 10차 그림의 열·줄) + 10차 32장을 이은 그림만 씀
    const surf = this.design().surf?.[state.surf]?.[state.stage];
    if (surf) {
      if (this.surfKey !== surf.key) {
        this.surfSh?.destroy();
        this.surfSh = this.add.shader(SURF_SHADER, surf.x, surf.y, surf.w, surf.h, [surf.map, surf.atlas]).setOrigin(0).setDepth(-4);
        this.surfSh.setUniform('mapScale.value', { x: surf.w / surf.mw, y: surf.h / surf.mh });
        this.surfSh.setUniform('cols.value', surf.cols);
        this.surfKey = surf.key;
      }
      this.surfT = (this.surfT + dt) % (surf.n * surf.ms);
      this.surfSh!.setUniform('frame.value', Math.floor(this.surfT / surf.ms)).setPosition(this.snap(surf.x), this.snap(surf.y)).setVisible(true);
    } else this.surfSh?.setVisible(false);
    if (this.EX.on) this.stepExpand(dt);
    // 화산
    if (this.volcP) {
      this.volcP.step(dt);
      if (this.erupting && this.volcP.done) {
        this.volcSet(state.volcRest);
        this.onTick?.();
      }
      const [c, r] = this.design().volcano.cell;
      const vh = this.design().volcano.size[1];
      if (this.volc.texture.key !== this.volcKey) this.volc.setTexture(this.volcKey);
      this.volc.setFrame(this.volcP!.f).setPosition(c * T, (r + vh) * T).setDepth((r + vh) * T);
    }
    // 혼비백산만 보기 (4.2초)
    if (this.PO.on) {
      this.PO.t += dt;
      if (this.PO.t > 4200) {
        this.PO.on = false;
        this.panicStop();
        this.onTick?.();
      }
    }
    const panic = this.PN.length > 0;
    if (panic) this.stepPanic(dt);
    // 가운데 줄
    STAGE_IDS.forEach((s, i) => {
      const p = this.rowP[s];
      p.step(dt);
      const [c, r] = this.design().rows[i];
      this.put(this.rowActors[s], this.anim(s, state.row[s]).src, p, (c + 0.5) * T, (r + 0.5) * T, 1, state.rowOn && !panic);
    });
    // 돌아다니는 귤새
    if (!panic) this.updateWander(dt);
    this.put(this.wActor, this.wanderSrc(), this.W.player, this.W.x, this.W.y, this.W.facing, !panic);
    if (panic) this.drawPanic();
    this.drawDebug();
  }

  private drawDebug() {
    const g = this.dbg;
    g.clear();
    if (!state.debug) return;
    const st = this.island();
    g.lineStyle(1, 0xffffff, 0.35);
    for (let c = 0; c <= this.design().grid[0]; c++) g.lineBetween(c * T, 0, c * T, this.design().grid[1] * T);
    for (let r = 0; r <= this.design().grid[1]; r++) g.lineBetween(0, r * T, this.design().grid[0] * T, r * T);
    g.fillStyle(0xf08a3c, 0.25);
    for (const [c, r] of st.walk) g.fillRect(c * T + 2, r * T + 2, T - 4, T - 4);
    g.fillStyle(0xf08a3c, 1);
    for (const p of this.walkPoints()) g.fillCircle(p.x, p.y, 3);
    const q = this.volcRect();
    g.lineStyle(1, 0xff3b3b, 0.9).strokeRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);
    if (this.W.target) g.lineStyle(1, 0xffffff, 1).lineBetween(this.W.x, this.W.y, this.W.target.x, this.W.target.y);
  }

  status() {
    const st = this.D.screen.stages[state.wander];
    const names: Record<Mode, string> = { rest: '쉬는 중', move: '이동 중', takeoff: '이륙', fly: '나는 중', land: '착지', hatch: '성장 중' };
    const tile = Math.round(this.zoom() * T);
    return `${st.label} · ${this.PN.length ? '혼비백산' : names[this.W.mode]} · ${this.W.player.f}번 프레임${this.erupting ? ' · 화산 분출 중' : ''} · 바다 ${this.seaP ? this.seaP.f + '번' : '정지'} · 파도 ${Math.floor(this.surfT / 110)}번 · 타일 ${tile}px`;
  }
}
