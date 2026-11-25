# 애니메이션 파일 형식

**애니메이션 하나 = 폴더 하나.** 폴더 안에 파일 2~3개.

```
animations/gyulsae/adult/waddle/
├── anim.json    ← 프레임 크기 · 장마다 시간 · 이동 거리 · 뜬 높이 · 재생 방식
├── sheet.png    ← 몸 그림 (가로 한 줄로 이어 붙인 시트)
└── shadow.png   ← 그림자 그림 (있을 때만 · 몸과 같은 크기·같은 장 수)
```

- 전체 목록: [CATALOG.md](CATALOG.md) (id · 폴더 · 크기 · 장 수 · 재생 방식 · 설명 표)
- id → 폴더 대응: [index.json](index.json) — 화면은 이 파일부터 읽음
- 애니메이션끼리 잇는 정보(단계별 동작 · 날기 묶음 · 혼비백산 붙일 자리 · 부화/자라기/쓰담 연결): [links.json](links.json)
- 숲 탐험(시작 · 숲 속 돌아다니기 · 물건 찾기 · 떠나기): [../scenes/forest-explore/README.md](../scenes/forest-explore/README.md)

## 폴더 이름 규칙

`<무리>/<단계>/<동작>` 또는 `<무리>/<동작>`.

| 폴더 | 무엇 |
|---|---|
| `gyulsae/egg/` · `gyulsae/juvenile/` · `gyulsae/adult/` | 귤새(캐릭터) 알 · 어린 귤새 · 성체 귤새 단계별 동작 |
| `gyulsae/hatch/` | 부화 (알 → 어린 귤새) |
| `gyulsae/grow/` | 자라기 (어린 귤새 → 성체 귤새) |
| `volcano/` | 화산 (가만히 · 분출) |
| `volcano/ash-cover/` | 섬 넓히기 때 화면을 덮는 화산재 덩이 + `timeline.json`(시간표) |
| `sea/` | 바다 (화면 전체에 반복해서 깖) |
| `fx/` | 이펙트 (혼비백산 "!"·땀방울, 쓰담 하트) |

동작 이름: `still` = 디자이너 원본 한 장(정지) · `idle*` = 제자리 · `waddle`/`hop`/`roll` = 걷기 · `fly` = 날기 ·
`takeoff`/`land` = 이륙/착지 · `startle` = 깜짝 · `panic-a`/`panic-b` = 혼비백산 달리기 · `pet-a`/`pet-b` = 쓰담쓰담.

**id** 는 코드·`links.json` 에서 부르는 이름이에요 (예: `gyulsae-adult-waddle`). 폴더를 옮기면 `index.json` 만 바뀌고 id 는 그대로.

## sheet.png

- 장(프레임)을 **왼쪽부터 가로 한 줄**로 이어 붙임. 0번 장 = 맨 왼쪽.
- 한 칸 크기 = `frameWidth × frameHeight`. 시트 크기 = `(frameWidth × frameCount) × frameHeight`.
- 픽셀아트 — 확대할 때 **번지게(smoothing) 하지 말 것**, 정수 배율로.
- 귤새는 **오른쪽을 보는 그림**. 왼쪽으로 갈 땐 좌우 뒤집어 그림.

## anim.json

```jsonc
{
  "id": "gyulsae-adult-waddle",        // 코드에서 부르는 이름
  "label": "성체 귤새 — 뒤뚱 걷기 (날개를 팔처럼)",
  "playback": "loop",                   // loop | once | timeline (아래)
  "frameWidth": 32,                     // 한 장 가로 px
  "frameHeight": 32,                    // 한 장 세로 px
  "frameCount": 8,                      // 장 수
  "totalMs": 880,                       // 한 바퀴 시간 = durationsMs 합 (참고용)
  "sheet": "sheet.png",
  "shadow": "shadow.png",               // 없으면 null
  "durationsMs": [110, 110, ...],       // 장마다 보여 주는 시간(ms) — 장마다 다를 수 있음!
  "motionPx":   [1, 1, ...],            // 장마다 그 장 동안 앞으로 가는 거리(그림 px). 0 = 제자리
  "liftPx":     [0, 0, ...]             // 장마다 위로 뜬 높이(그림 px, 음수 = 위). 그림자는 안 뜸
}
```

이펙트(`fx/`)에만 있는 칸:

- `pivot: [x, y]` — 그림 안의 기준점. 이 점을 붙일 자리에 맞춰 그림 (fx 전부에 있음).
- `lifetimeMs` — 이펙트를 띄워 두는 시간. 지나면 지움 (쓰담 하트에만 있음).

### playback

| 값 | 뜻 | 예 |
|---|---|---|
| `loop` | 끝 장 다음 0번 장으로 계속 | 가만히 · 걷기 · 날기 · 바다 · 화산 가만히 |
| `once` | 한 번 재생하고 **끝 장에서 멈춤** | 이륙 · 착지 · 부화 · 자라기 · 분출 · 깜짝 · 이펙트 |
| `timeline` | 혼자 재생 안 함. 다른 시간표가 장 번호를 고름 | `volcano/ash-cover/*` (→ `timeline.json`) |

## 재생 규칙 (어느 프론트든 같음)

[`src/player.ts`](../../src/player.ts) (참고 코드) 가 이 규칙 그대로예요. React Native · 캔버스 등으로 옮길 때 이것만 지키면 움직임이 같아요.

```
f = 0, t = 0                       // 지금 장, 지금 장을 보여 준 시간
매 화면 갱신마다 dt(ms) 지남:
  while dt > 0:
    use = min(dt, durationsMs[f] - t)
    앞으로 간 거리 += motionPx[f] * use / durationsMs[f]   // 장 안에서도 시간 비율로 → 발이 안 미끄러짐
    t += use; dt -= use
    if t >= durationsMs[f]:
      t = 0
      if f + 1 < frameCount: f += 1
      elif loop: f = 0
      else: 끝 (f = 끝 장에 멈춤)
뜬 높이 = liftPx[f] 에서 다음 장 liftPx 까지 t / durationsMs[f] 비율로 이어서
```

- `src/player.ts` 의 `new Player(anim)` 은 `playback === 'loop'` 일 때만 반복 (둘째 인자로 바꿀 수 있음).
- 이펙트는 `lifetimeMs` 가 지나면 끝 장 전이라도 지움 (`lifetimeMs` 가 `totalMs` 보다 조금 짧음 — 원래 그렇게 맞춘 값).

## 그리는 자리 (무리마다 기준점이 다름)

| 무리 | 기준점 | 자리 |
|---|---|---|
| `gyulsae/*` (귤새) | 그림 **가운데** | 좌표 (x, y) = 그림 가운데. **발 = (x, y + frameHeight/2)** (32×32 면 y+16, 시트 맨 아래 줄). 걷는 칸 (c, r) 에 세울 땐 x = (c+0.5)·32, y = (r+0.5)·32. 몸은 (x, y + 뜬 높이), 그림자는 (x, y) — 뜨지 않음 |
| `gyulsae/hatch` · `grow` | 그림 가운데 | 귤새와 같음 (섬에서 재생할 때) |
| `volcano/*` | 그림 **왼쪽 아래** | 섬의 화산 자리(3×2칸)의 **왼쪽 아래 모서리**에 맞춤. 그림(96×128)이 자리(3×2칸)보다 위로 2칸 더 올라감 — 연기·분출 자리 |
| `volcano/ash-cover/*` | 그림 왼쪽 위 | `timeline.json` 의 x, y (+ 화산 칸이 옮겨진 만큼) |
| `sea/*` | 그림 왼쪽 위 | 32 의 배수 자리부터 화면 전체에 바둑판처럼 반복 |
| `fx/*` | `pivot` | pivot 점을 붙일 자리에 맞춤 (아래 '이펙트 붙이기') |

- **앞뒤 순서(깊이)**: 발 높이(y + frameHeight/2) 가 큰 것(화면 아래쪽)을 나중에 그림. 그림자는 같은 깊이에서 몸보다 먼저.
- **좌우 뒤집기**: 귤새 그림은 오른쪽 보기. 왼쪽으로 갈 땐 **몸과 그림자를 둘 다** 그림 가운데를 축으로 뒤집음 (그림자가 그림 안에서 움직이는 동작이 있어서 그림자도 뒤집어야 맞음).

## 이동 (걷기 · 날기)

- A → B **직선**(대각선 포함)으로, 매 갱신마다 `step(dt)` 가 돌려준 거리만큼 감 — 속도를 따로 정하지 말 것 (발과 바닥이 맞게).
- 방향(좌우 뒤집기)은 출발할 때 B.x ≥ A.x 면 오른쪽으로 한 번 정함. B 에 닿으면 그 자리에 멈추고 남은 거리는 버림. 8px 보다 가까우면 출발 안 함.
- 날기 = `takeoff`(1회, 그동안도 motionPx 만큼 감) → `fly`(반복) → 남은 거리 ≤ `land` 의 motionPx 합 이고 `fly` 가 끝 장일 때 → `land`(1회) → 쉬기.
  묶음은 `links.json` `stages.<단계>.anims[]` 의 `kind: "flight"` 항목 (`takeoff` · `src` · `land`).

## 이펙트 붙이기

- **혼비백산** (`fx-panic-bang` "!" · `fx-panic-sweat` 땀방울): 붙일 자리 = `links.json` → `panic.attach[단계][이펙트 id]` — 귤새 그림 **왼쪽 위 기준** 그림 px (뜬 높이도 더함).
  이펙트의 `pivot` 을 그 자리에 맞춤. 귤새가 왼쪽을 보면 x 를 `32 - x` 로, 땀방울은 같이 뒤집고 "!" 는 안 뒤집음. "!" 는 1.6~3.2초마다, 땀방울은 0.45~0.9초마다 다시 띄움.
- **쓰담 하트** (`pet-heart` · `-l` · `-r`): pivot 을 귤새 그림 가운데에서 약 4 그림 px 아래에, 귤새 **앞**에. `pet-love`(3번 채움): 가운데에서 6 그림 px 아래, 귤새 **뒤**에. 이펙트도 귤새와 같은 배율로 키움.

## 이름 붙임 a · b · c 뜻

- `idle-a/b` · `panic-a/b` · `hatch/a,b` · `grow/a,b,c` = **골라 쓰는 대안판** (하나만 씀, 이어 붙이는 순서 아님).
- `pet-a` = 누르는 동안(hold, 반복) · `pet-b` = 다 채우고 손 뗄 때(happy, 1회) — **역할이 다른 짝**.
- id 는 폴더 이름과 규칙이 다를 수 있으니 **꼭 [index.json](index.json) / [CATALOG.md](CATALOG.md) 에서 찾을 것** (예: 정지 = `gyulsae-adult`, 하트 = `pet-heart`, 바다 일렁임 = `sea-v4-b`).

## 고치면 안 되는 것 · 고치는 법

- 이 폴더는 **자동으로 만들어진 결과**예요 (원본 = 도트 편집 파일 `.dot.json`, 내보내기 도구는 저장소 주인의 비공개 저장소에 있음 — **이 저장소에는 없으니 실행하려 하지 말 것**).
  `anim.json` · `sheet.png` · `index.json` · `CATALOG.md` 를 손으로 고치면 다음 내보내기 때 덮어써져요. 그림·박자를 바꾸고 싶으면 스프라이트 담당에게 요청하거나 이슈로 남겨 주세요.
- 이 README 만 손으로 쓴 파일이에요 (내보내기가 지우지 않음).
- 디자이너 기본 그림(`still`, 섬 조각, 바다 원본, 화산 원본)은 **고치지 않는 게 규칙**이에요. 움직임만 더함.
