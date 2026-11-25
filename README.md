# 가치고치 애니메이션 (프론트 전달용)

제주 친환경·상생 게이미피케이션 앱 **가치고치**의 애니메이션 묶음이에요.
프론트는 이 저장소의 그림 시트와 JSON 을 가져가서, 각 README 의 규칙대로 화면에 그리면 돼요.

## 들어 있는 것

| 경로 | 무엇 | 설명서 |
|---|---|---|
| `assets/animations/` | 귤새(알 · 어린 귤새 · 성체) 동작 · 부화 · 자라기 · 화산 · 화산재 · 바다 · 이펙트("!" · "?" · 땀방울 · 하트 · 폭죽 · 나뭇잎) — 애니메이션마다 폴더 하나 (`anim.json` + `sheet.png` + 있으면 `shadow.png`) | [README](assets/animations/README.md) · [목록](assets/animations/CATALOG.md) |
| `assets/animations/links.json` | 애니메이션끼리 잇는 정보 — 단계별 동작 · 날기 묶음 · 혼비백산 이펙트 붙일 자리 · 부화/자라기/쓰담 연결 | [README](assets/animations/README.md) |
| `assets/scenes/forest-explore/` | **숲 탐험** — 시작 · 숲 속 돌아다니기(반복) · 물건 찾기 · 떠나기. 캐릭터별 그림 모음(`kit.png`) + 장면 재생표(JSON) | [README](assets/scenes/forest-explore/README.md) |
| `src/player.ts` | 애니메이션 재생 규칙 참고 코드 (장마다 시간 · 이동 · 뜬 높이) | |
| `src/forestExplore.ts` | 숲 탐험 그리기 규칙 참고 코드 (재생표 → 그림, 프레임워크 무관) | |

## 쓰는 순서

1. `assets/animations/index.json` (id → 폴더) 로 필요한 애니메이션을 찾고, 폴더의 `anim.json` 대로 `sheet.png` 를 재생.
2. 재생 규칙(장마다 시간이 다름 · 걷는 거리 · 뜬 높이 · 기준점 · 좌우 뒤집기)은 [assets/animations/README.md](assets/animations/README.md).
3. 숲 탐험은 [assets/scenes/forest-explore/README.md](assets/scenes/forest-explore/README.md) — 장면 순서, 섬과 잇는 좌표, 재생표 형식, 그리는 순서가 다 적혀 있어요.

픽셀아트라 확대할 땐 번지게 하지 말고 정수 배로 (Phaser `pixelArt: true` · 캔버스 `image-rendering: pixelated`).
그림은 디자이너 그림 그대로예요(색·모양 안 바꿈) — 움직임과 이펙트만 더했어요.
