# AGENTS.md — AI 가 이 저장소를 읽을 때

> 이 파일은 AI 코딩 도구(Claude Code · Codex · Cursor 등)가 먼저 읽는 설명서예요. 사람용 요약은 [README.md](README.md).
> 문서·주석은 한국어. 답변도 한국어로.

## 이 저장소는

**가치고치**(제주 친환경·상생 게이미피케이션 앱)의 **섬 화면 테스트판**. 귤새(캐릭터)가 섬을 돌아다니고, 화산이 터져 섬이 넓어지고, 부화·자라기·쓰담쓰담 연출이 나오는 화면을 브라우저에서 확인하는 곳.

- 팀 앱 프론트(`Ga-chi-Gochi/Gachi-Gochi-FE`, Expo React Native)의 `game/` 과 같은 **Vite + Phaser 3.90** 구성. 팀 앱에 넣기 전에 여기서 움직임을 맞춤.
- 이 저장소의 핵심 산출물은 **`assets/animations/`** — 애니메이션마다 폴더 하나(그림 시트 + 설명 JSON). 다른 프론트는 이 파일만 가져가서 [재생 규칙](assets/animations/README.md#재생-규칙-어느-프론트든-같음)대로 그리면 같은 움직임이 나옴.
- 배포본: https://gachigochi-island.vercel.app/island/ (배포는 저장소 주인이 직접 요청할 때만)

## 실행

```bash
npm install
npm run dev      # http://localhost:5192
npm run build    # dist/
```

## 폴더 지도

```
assets/                      Vite publicDir — 화면에서는 이 폴더가 주소 맨 앞 (예: fetch('screen.json'))
├── animations/              ★ 애니메이션 (자동 생성)
│   ├── README.md            형식 설명 (손으로 씀) ← 애니메이션을 다룰 땐 먼저 읽기
│   ├── CATALOG.md           전체 목록 표 (자동 생성)
│   ├── index.json           id → 폴더
│   ├── gyulsae/<단계>/<동작>/{anim.json, sheet.png, shadow.png}
│   ├── gyulsae/hatch/*  gyulsae/grow/*   부화 · 자라기
│   ├── volcano/*            화산 가만히 · 분출
│   ├── volcano/ash-cover/   화산재 덩이 + timeline.json (섬 넓히기 시간표)
│   ├── sea/*                바다
│   └── fx/*                 이펙트 ("!" · 땀방울 · 하트)
├── island/
│   ├── tiles.png            섬 조각 한 줄 (32px 칸, 번호 = 왼쪽부터)
│   └── <섬>.json            섬 하나: 칸마다 조각 번호 · 걷는 칸 · 화산 자리 (_about 칸에 설명)
├── surf/                    해안 파도 셰이더용 그림 (지도 + 32장 이은 그림)
├── ui/                      앱 화면 요소 그림 (경험치 바 · 아이콘) — 디자이너 그림 그대로
└── screen.json              화면 설정: 단계마다 어떤 동작을 쓰는지 · 화산/바다 목록 · 혼비백산/성장/쓰담 연결
src/
├── main.ts                  시작점: assets JSON 을 다 읽고(loadData) Phaser 게임을 만듦 + 오른쪽 사이드바 버튼
├── data.ts                  데이터 모양(타입) · 불러오기(loadData) · 사이드바 선택 상태(state)
├── player.ts                애니메이션 재생기 (장마다 시간 · 이동 · 높이) ← 재생 규칙의 정답
├── scene.ts                 Phaser 장면: 섬 · 바다 · 해안 파도 · 화산 · 돌아다니는 귤새 · 섬 넓히기 · 혼비백산 · 섬에서 부화
└── overlay.ts               Phaser 위 2D 캔버스: 성장 창 · 쓰담쓰담 창 · 앱 화면 요소(HUD)
index.html                   화면 + 오른쪽 사이드바 (테스트용 버튼)
```

## 데이터 흐름

1. `main.ts` → `loadData()` (`data.ts`): `screen.json` + `animations/index.json` → 모든 `anim.json` · `island/*.json` · `timeline.json` 을 한꺼번에 읽어 `Data` 하나로 묶음.
2. `IslandScene(D)` 의 `preload()`: 애니메이션마다 Phaser 텍스처 두 개를 읽음 — `id`(몸) · `id-shadow`(그림자). 텍스처 키 = 애니메이션 id.
3. 재생은 Phaser 의 anims 기능을 **쓰지 않고** `Player`(player.ts) 로 직접: 장마다 시간이 다르고, 걷는 거리를 장에 맞춰야 해서.

## 애니메이션 다루기

- 형식·재생 규칙·그리는 기준점·이동·이펙트 붙이기: **[assets/animations/README.md](assets/animations/README.md)** (꼭 읽기)
- 무엇이 있는지: [assets/animations/CATALOG.md](assets/animations/CATALOG.md)
- 어디에 쓰이는지: `screen.json`
  - `stages.<egg|juvenile|adult>` — 단계별 동작 목록. `kind`: `idle`(제자리) · `move`(걷기, motionPx 로 이동) · `flight`(takeoff → src 반복 → land). `rest` = 쉴 때 동작 key, `auto` = 돌아다닐 때 동작 key.
  - `panic.stages.<단계>` — 섬 넓히기 때 혼비백산: `startle`(1회) → `panic` 중 하나(반복) + `panic.fx` 이펙트.
  - `growth[]` — 부화(`kind: hatch`)·자라기(`grow`): `anim` 재생, `frm → to` 단계, 창 문구(`title` · `body` · `lv`). `reveal` = 그림이 다음 단계 모습으로 바뀌는 장 번호(참고값 — 이 화면 코드는 안 씀, 앱에서 단계를 바꿀 시점으로 쓸 수 있음).
  - `pet.<단계>` — 쓰담쓰담: `hold`(누르는 동안 반복) · `happy`(다 채우고 손 뗄 때 1회). `petFx` = 하트 이펙트 목록.
  - `volcano[]` — `kind: rest`(반복) / `erupt`(1회 → 끝나면 rest 로).
- **애니메이션 id 를 가리키는 칸**: `seas[].key` · `volcano[].key` · `stages.*.anims[].src`/`takeoff`/`land` · `stages.*.rest`/`auto` 는 **id 가 아니라 그 단계 anims[].key** · `panic.stages.*` · `growth[].anim` · `pet.*.hold`/`happy` · `petFx[]` · `ashTimeline.frames[][0]`.
- 지금 코드에 id 를 직접 쓴 곳: 혼비백산 이펙트(`fx-panic-bang` · `fx-panic-sweat`), 쓰담 이펙트(`pet-heart` · `-l` · `-r` · `pet-love`). `screen.json` 의 `panic.fx` · `petFx` 는 미리 불러오기용이라, 바꾸려면 코드도 같이 고쳐야 함.

### 쓰담쓰담 흐름 (overlay.ts)

- 창이 열리면 `hold` 0번 장에 멈춤(idle). 귤새를 누르면 `hold` 반복.
- 누른 채 36pt 문지를 때마다 쓰담 1번 → 하트 하나 (`pet-heart` · `-l` · `-r` 중 무작위, 동시에 최대 2개, 450ms 간격, `pet-love` 가 떠 있으면 안 띄움).
- 3번째 쓰담 = 하트 대신 `pet-love`(귤새 뒤). 그 뒤 손을 떼면 `happy` 1회 → idle.
- 3번 못 채우고 떼면 `hold` 끝 장을 잠깐 보여 주고 idle.
- 섬 넓히기 화산재: `animations/volcano/ash-cover/timeline.json` — 장마다 [덩이 id, 그림 번호, x, y] 목록. `scene.ts` 의 `stepExpand()` 가 읽음.

### 새 애니메이션을 화면에 붙이려면

1. 그림·박자는 원본 도트 파일에서 만들어 내보냄(아래 '원본'). 직접 만든다면 `assets/animations/<무리>/<이름>/` 에 `sheet.png` + `anim.json`(형식 그대로) 을 넣고 `index.json` 에 `"id": "폴더"` 를 추가.
2. 쓰일 자리를 `screen.json` 에 적음 (예: `stages.adult.anims` 에 `{ "key", "label", "kind", "src": "<id>" }`).
3. 코드는 id 로만 부름 — 경로를 코드에 직접 쓰지 말 것 (`sheetUrl(anim)` 사용).

## 원본과 자동 생성 (중요)

- `assets/` 의 `animations/` · `island/` · `surf/` · `ui/` · `screen.json` 은 **자동으로 만들어진 결과**. 원본(도트 편집 파일 `.dot.json`, 디자이너 원본 그림)과 내보내기 도구는 저장소 주인의 비공개 저장소에 있고, 도구가 이 저장소 `assets/` 를 통째로 다시 씀. **이 저장소에는 그 도구가 없으니 실행하려 하지 말 것.**
- 그래서 **자동 생성 파일을 손으로 고치면 다음 내보내기 때 사라짐.** 바꿔야 하면 이슈로 남기거나, 고친 내용을 커밋 메시지에 분명히 적어 원본에도 옮길 수 있게.
- 손으로 쓴 파일: `src/**` · `index.html` · 설정 파일 · `README.md` · `AGENTS.md` · `assets/animations/README.md`.

## 규칙 (지켜 주세요)

1. **디자이너 기본 그림은 고치지 않음** — 섬 조각 · 바다 원본 · 화산 원본 · 귤새 원본(`still`) · `ui/` 그림. 위에 움직임(물결 · 화산재 · 동작)만 더함. 디자이너 조각에 없는 모양이 필요하면 '우리가 만든 판 / 원래대로 판' 두 가지를 같이 보여 주고 고르게 함 (예: `island/*.json` 의 `grass.made` / `grass.orig`).
2. **픽셀아트**: 확대할 때 번지지 않게(`pixelArt: true`, 2D 캔버스는 `imageSmoothingEnabled = false`), 타일이 기기 픽셀 정수가 되는 배율만 씀.
3. **`roundPixels` 는 끔.** Phaser 3.90 은 pixelArt 면 위치를 '그림 픽셀' 단위로 내려서, 확대하면 귤새가 몇 px 씩 툭툭 뜀. 대신 `scene.ts` 의 `snap()` 으로 **기기 픽셀** 단위에 맞춤. 팀 앱 `game/` 에도 같은 문제가 있을 수 있음.
4. 1타일 = 32px. 귤새 그림 32×32, 오른쪽 보기 기준.
5. 걷는 속도를 따로 정하지 말고 `motionPx` 대로 옮김 (발이 미끄러지지 않게).
6. 커밋 메시지·주석은 한국어.

## 빠진 것 · 할 일

- 화산재 '섬만 가리기' 판 (제주 섬 모양으로 다시 계산 필요)
- 풀 안쪽 모서리 디자이너 조각 (지금은 우리가 만든 조각 `grass.made`)
- 보상 팡파레 · 탐험 보상 알 연출은 2026-11-20 에 이 화면에서 뺌 (원본은 비공개 저장소에 남아 있음)
