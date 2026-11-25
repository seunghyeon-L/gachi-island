# 가치고치 섬 화면 (Phaser)

제주 친환경·상생 게이미피케이션 앱 **가치고치**의 섬 화면 테스트판이에요.
귤새가 제주 모양 섬을 돌아다니고, 화산이 터져 섬이 넓어지고, 부화·자라기·쓰담쓰담 연출이 나와요.

- 보기: https://gachigochi-island.vercel.app/island/
- 팀 앱 프론트(Expo React Native)의 `game/` 과 같은 **Vite + Phaser 3.90** 구성

```bash
npm install
npm run dev      # http://localhost:5192
```

마우스 휠 = 확대·축소, 끌기 = 이동 (폰: 두 손가락 · 한 손가락). 오른쪽 사이드바에서 연출을 하나씩 틀어 볼 수 있어요.

## 애니메이션 가져다 쓰기

애니메이션은 **폴더 하나에 하나씩** 들어 있어요 — 다른 프론트에서도 그대로 가져다 쓸 수 있게.

```
assets/animations/gyulsae/adult/waddle/
├── anim.json    프레임 크기 · 장마다 시간(ms) · 이동 거리 · 뜬 높이 · 반복/1회
├── sheet.png    몸 그림 (장을 가로 한 줄로)
└── shadow.png   그림자 (있을 때만)
```

- 형식과 재생 규칙: [assets/animations/README.md](assets/animations/README.md)
- 전체 목록: [assets/animations/CATALOG.md](assets/animations/CATALOG.md)
- 어느 화면에 무엇을 쓰는지: [assets/screen.json](assets/screen.json)

## 폴더

| 경로 | 무엇 |
|---|---|
| `assets/animations/` | 애니메이션 (귤새 · 화산 · 바다 · 이펙트 · 화산재 시간표) |
| `assets/scenes/forest-explore/` | 숲 탐험 (시작 · 숲 속 돌아다니기 반복 · 물건 찾기 · 떠나기) — [README](assets/scenes/forest-explore/README.md) |
| `assets/island/` | 섬 조각 그림 + 섬마다 칸 배치 |
| `assets/surf/` | 해안 파도 셰이더 그림 |
| `assets/ui/` | 앱 화면 요소 그림 |
| `assets/screen.json` | 화면 설정 |
| `src/` | 화면 코드 (`player.ts` = 재생기, `scene.ts` = Phaser 장면, `overlay.ts` = 창 연출) |

AI 도구로 작업할 땐 [AGENTS.md](AGENTS.md) 를 먼저 읽게 해 주세요 (폴더 지도 · 데이터 흐름 · 규칙).

`assets/` 의 그림·데이터는 원본 도트 파일에서 **자동으로 내보낸 결과**라서, 손으로 고치면 다음 내보내기 때 덮어써져요. 바꾸고 싶은 게 있으면 이슈로 남겨 주세요.
