// 애니메이션 재생기 — 어떤 프론트(Phaser · React Native · 캔버스)로 옮겨도 이 규칙만 지키면 같은 움직임이 나옴.
//   · 장마다 정해진 시간(durationsMs)만큼 보여 줌 — 장마다 시간이 다름 (고르지 않은 박자가 동작의 맛)
//   · 그 장 동안 motionPx 만큼 앞으로 감. 시간 비율로 나눠 이어서 → 발이 미끄러지지 않음
//   · liftPx 만큼 위로 뜸(음수 = 위). 다음 장 값까지 시간 비율로 이어서. 그림자는 안 뜸
//   · loop 이면 끝 장 다음 0번, 아니면 끝 장에 멈추고 done = true (뜬 높이도 loop 면 끝 장 → 0번으로 이어서, 아니면 끝 장에서 안 이음)
/** anim.json 한 개 (형식: assets/animations/README.md) */
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
};

export class Player {
  /** 지금 장 번호 (시트에서 왼쪽부터 0번) */
  f = 0;
  /** 지금 장을 보여 준 시간(ms) */
  t = 0;
  done = false;

  /** loop 를 안 주면 anim.json 의 playback 대로 (loop 만 반복) */
  constructor(public a: Anim, public loop = a.playback === 'loop') {}

  /** dt(ms) 만큼 재생하고, 그동안 움직인 거리(그림 px)를 돌려줌 */
  step(dt: number) {
    let moved = 0;
    while (dt > 0 && !this.done) {
      const ms = this.a.durationsMs[this.f];
      const use = Math.min(dt, ms - this.t);
      moved += ((this.a.motionPx[this.f] || 0) * use) / ms;
      this.t += use;
      dt -= use;
      if (this.t >= ms) {
        this.t = 0;
        if (this.f + 1 < this.a.frameCount) this.f++;
        else if (this.loop) this.f = 0;
        else {
          this.done = true;
          this.t = ms;
        }
      }
    }
    return moved;
  }

  /** 지금 높이(그림 px, 음수 = 위). 다음 장 값까지 시간 비율로 이어서 */
  lift() {
    const L = this.a.liftPx;
    const n = L.length;
    if (!L.some((v) => v)) return 0;
    const k = this.t / this.a.durationsMs[this.f];
    const nx = this.loop ? (this.f + 1) % n : Math.min(n - 1, this.f + 1);
    return L[this.f] + (L[nx] - L[this.f]) * (this.done ? 0 : k);
  }
}
