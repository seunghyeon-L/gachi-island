// 화면이 읽는 데이터의 모양과 불러오기.
// 파일은 전부 assets/ (Vite publicDir → 화면 주소 기준 경로). 형식 설명: AGENTS.md · assets/animations/README.md
//
//   assets/screen.json                 화면 설정 (어느 단계에 어떤 동작을 쓰는지 등)
//   assets/animations/index.json       애니메이션 id → 폴더
//   assets/animations/<폴더>/anim.json  애니메이션 하나 (프레임 크기·장마다 시간·이동·높이)
//   assets/island/<섬>.json            섬 하나 (칸별 조각 번호·걷는 칸·화산 자리)
//   assets/animations/volcano/ash-cover/timeline.json  섬 넓히기 화산재 시간표

/** 애니메이션 하나 = assets/animations/<폴더>/anim.json (+ 불러온 뒤 붙이는 경로) */
export type Anim = {
  id: string;
  label: string;
  /** loop = 끝나면 0번부터 · once = 한 번 재생하고 끝 장에 멈춤 · timeline = 혼자 재생 안 함(시간표가 장을 고름) */
  playback: 'loop' | 'once' | 'timeline';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  totalMs: number;
  sheet: string;
  shadow: string | null;
  /** 장마다 보여 주는 시간(ms) */
  durationsMs: number[];
  /** 장마다 그 장 동안 앞으로 가는 거리(그림 px) — 걷기·날기. 0 = 제자리 */
  motionPx: number[];
  /** 장마다 위로 뜬 높이(그림 px, 음수 = 위). 그림자는 안 뜸 */
  liftPx: number[];
  /** 이펙트 기준점(그림 안 px) — 이 점을 붙일 자리에 맞춤 */
  pivot?: [number, number];
  /** 이펙트가 떠 있는 시간(ms) — 지나면 지움 */
  lifetimeMs?: number;
  /** 불러온 뒤 붙임: 폴더 (assets/animations/ 기준) */
  dir: string;
};

export type Kind = 'idle' | 'move' | 'flight';
export type AnimDef = { key: string; label: string; kind: Kind; src: string; takeoff?: string; land?: string; shadow_from?: string };
export type StageId = 'egg' | 'juvenile' | 'adult';
export type StageDef = { label: string; rest: string; auto: string; anims: AnimDef[] };
export type IslandStage = {
  map: string[];
  sand: number[][];
  grass: { made: number[][]; orig: number[][] };
  props: [number, number, number][];
  walk: [number, number][];
  walk_targets: [number, number][];
};
export type Design = {
  label: string;
  grid: [number, number];
  rows: [number, number][];
  volcano: { cell: [number, number]; size: [number, number] };
  stages: IslandStage[];
  surf?: Record<string, { key: string; map: string; atlas: string; cols: number; x: number; y: number; w: number; h: number; mw: number; mh: number; n: number; ms: number }[]>;
};
export type AshTimeline = {
  ms: number[];
  phases: { rumble: number; erupt: number; cover: number; covered: number; clear: number; done: number };
  volcano: string;
  volcano_start_ms: number;
  solid?: { color: string; from_ms: number; to_ms: number };
  box: [number, number, number, number];
  swap_ms: number;
  frames: [string, number, number, number][][];
  origin: [number, number];
};
export type Growth = { key: string; kind: 'hatch' | 'grow'; label: string; anim: string; reveal: number; frm: StageId; to: StageId; title: string; body: string; lv: string };
export type Screen = {
  tileSize: number;
  tiles: string;
  tileCount: number;
  defaultDesign: string;
  designs: { key: string; label: string; file: string }[];
  seas: { key: string; label: string }[];
  volcano: { key: string; kind: 'rest' | 'erupt'; label: string }[];
  ashTimeline: string;
  stages: Record<StageId, StageDef>;
  panic: { stages: Record<StageId, { startle: string[]; panic: string[] }>; fx: string[]; attach: Record<StageId, Record<string, [number, number]>> };
  growth: Growth[];
  pet: Record<StageId, { hold: string; happy: string }>;
  petFx: string[];
  ui: Record<string, string>;
};
/** 화면 전체가 쓰는 데이터 (불러온 뒤) */
export type Data = {
  screen: Screen;
  designs: Record<string, Design>;
  ash: AshTimeline;
  anims: Record<string, Anim>;
};

export const STAGE_IDS: StageId[] = ['egg', 'juvenile', 'adult'];

const getJson = async <T>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} 를 못 읽음 (${r.status})`);
  return r.json() as Promise<T>;
};

/** assets/ 의 JSON 을 전부 읽어 Data 로 묶음 (그림은 scene.ts preload 가 Phaser 로 읽음) */
export async function loadData(): Promise<Data> {
  const [screen, index] = await Promise.all([
    getJson<Screen>('screen.json'),
    getJson<{ animations: Record<string, string> }>('animations/index.json'),
  ]);
  const [designs, ash, anims] = await Promise.all([
    Promise.all(screen.designs.map(async (d) => [d.key, await getJson<Design>(d.file)] as const)).then(Object.fromEntries),
    getJson<AshTimeline>(screen.ashTimeline),
    Promise.all(
      Object.entries(index.animations).map(async ([id, dir]) => [id, { ...(await getJson<Anim>(`animations/${dir}/anim.json`)), dir }] as const),
    ).then(Object.fromEntries),
  ]);
  return { screen, designs, ash, anims };
}

/** 애니메이션 그림 주소 */
export const sheetUrl = (a: Anim) => `animations/${a.dir}/${a.sheet}`;
export const shadowUrl = (a: Anim) => (a.shadow ? `animations/${a.dir}/${a.shadow}` : null);

// 화면에서 고른 것들 (사이드바 ↔ 장면이 같이 봄)
export const state = {
  design: 'jeju',
  sea: 'sea-v4-b',
  surf: 'lapfoam' as string, // '10' = 예전 10차를 옮김 · 'lap' = 잔잔한 물가 · 'lapfoam' = 잔잔한 물가 + 흰 거품 조금 · 'off'
  stage: 1, // 0 = 넓히기 전, 1 = 넓힌 뒤
  grassCorner: 'made' as 'made' | 'orig',
  volcRest: 'volcano-idle-a',
  wander: 'adult' as StageId,
  wanderAnim: 'auto',
  rowOn: true,
  row: { egg: 'idle-a', juvenile: 'idle', adult: 'idle' } as Record<StageId, string>,
  shadow: true,
  panicVer: 0, // 혼비백산 달리기 A(0) / B(1)
  hatchWhere: 'panel' as 'panel' | 'island',
  petStage: 'juvenile' as StageId,
  speed: 1,
  paused: false,
  debug: false,
};
