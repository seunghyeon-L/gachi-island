# AGENTS.md — AI 가 이 저장소를 읽을 때

> 이 파일은 AI 코딩 도구(Claude Code · Codex · Cursor 등)가 먼저 읽는 설명서예요. 사람용 요약은 [README.md](README.md).
> 문서·주석은 한국어. 답변도 한국어로.

## 이 저장소는

**가치고치**(제주 친환경·상생 게이미피케이션 앱)의 **애니메이션 전달용 저장소**. 프론트(팀 앱 `Ga-chi-Gochi/Gachi-Gochi-FE`, Expo React Native + `game/` 의 Phaser 3.90)가 이 그림 시트와 JSON 을 가져가 화면에 넣음.
앱 화면 코드·섬 지도는 여기 없음 (애니메이션 정보만).

## 폴더 지도

```
assets/
├── animations/              ★ 애니메이션 — 폴더 하나 = anim.json + sheet.png (+ shadow.png)
│   ├── README.md            형식 · 재생 규칙 · 기준점 · 이펙트 붙이기 (손으로 씀) ← 먼저 읽기
│   ├── CATALOG.md           전체 목록 표
│   ├── index.json           id → 폴더
│   ├── links.json           애니메이션끼리 잇는 정보 (단계별 동작 · 날기 묶음 · 혼비백산 붙일 자리 · 부화/자라기/쓰담)
│   ├── gyulsae/<단계>/<동작>/   귤새 알 · 어린 귤새 · 성체 동작
│   ├── gyulsae/hatch/*  gyulsae/grow/*   부화 · 자라기
│   ├── volcano/*            화산 가만히 · 분출 · ash-cover/(화산재 덩이 + timeline.json)
│   ├── sea/*                바다
│   └── fx/*                 이펙트 ("!" · "?" · 땀방울 · 하트 · 폭죽 a·b·c · 나뭇잎)
└── scenes/forest-explore/   ★ 숲 탐험 (시작 · 숲 속 반복 · 물건 찾기 · 떠나기)
    ├── README.md            장면 순서 · 섬과 잇는 좌표 · 재생표 형식 · 그리는 순서 ← 먼저 읽기
    ├── forest.png           숲 그림
    ├── characters/<캐릭터>/  kit.png(그림 모음) · shadow.png · intro/loop/find/leave.json(재생표)
    └── source/              만드는 데 쓴 원본 (캐릭터 정보 · 장면 정의 · 시험용 물건 그림)
src/
├── player.ts                애니메이션 재생 규칙 참고 코드
└── forestExplore.ts         숲 탐험 그리기 규칙 참고 코드 (재생표 → 그림, 프레임워크 무관)
```

## 주의

- 그림은 디자이너 원본 그대로 — 색·모양을 바꾸지 말 것. 움직임·이펙트만 더함.
- 픽셀아트: 확대는 정수 배, 번지게(smoothing) 하지 말 것.
- 숲 탐험 `characters/` 는 도구로 구운 결과물 — 손으로 고치지 말고 애니메이션 담당에게 다시 굽기 요청.
