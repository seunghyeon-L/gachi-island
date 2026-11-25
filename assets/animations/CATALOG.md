# 애니메이션 목록 (자동 생성 — 손으로 고치지 말 것)

원본 도트 파일에서 내보내기 도구가 만듦(도구는 이 저장소에 없음). 형식 설명은 [README.md](README.md). 모두 56개. id 는 꼭 이 표나 index.json 에서 찾을 것 — 폴더 이름에서 추측하면 틀릴 수 있음 (예: 정지 = `gyulsae-adult`, 하트 = `pet-heart`, 바다 일렁임 = `sea-v4-b`).

| id | 폴더 | 크기 | 장 | 한 바퀴 | 재생 | 그림자 | 설명 |
|---|---|---|---|---|---|---|---|
| `fx-panic-bang` | [fx/panic-bang](fx/panic-bang/) | 16×16 | 13 | 830ms | once |  | 이펙트 — 혼비백산 "!" 말풍선 (1회, 고치 머리 위) |
| `fx-panic-sweat` | [fx/panic-sweat](fx/panic-sweat/) | 16×16 | 8 | 420ms | once |  | 이펙트 — 혼비백산 땀방울 (1회, 자주 다시 띄움) |
| `pet-heart` | [fx/pet-heart](fx/pet-heart/) | 32×48 | 20 | 660ms | once |  | 이펙트 — 쓰담 하트 (가운데) |
| `pet-heart-l` | [fx/pet-heart-l](fx/pet-heart-l/) | 32×48 | 20 | 660ms | once |  | 이펙트 — 쓰담 하트 (왼쪽으로) |
| `pet-heart-r` | [fx/pet-heart-r](fx/pet-heart-r/) | 32×48 | 20 | 660ms | once |  | 이펙트 — 쓰담 하트 (오른쪽으로) |
| `pet-love` | [fx/pet-love](fx/pet-love/) | 72×72 | 29 | 957ms | once |  | 이펙트 — 쓰담 쓰담 3번 채움 — 고리·하트 (귤새 뒤에) |
| `fx-firework-a` | [fx/firework-a](fx/firework-a/) | 32×32 | 7 | 710ms | once |  | 이펙트 — 폭죽 A — 흰 십자 → 연두·주황 빛살 → 붉게 바램 (1회, 가운데 기준) |
| `fx-firework-b` | [fx/firework-b](fx/firework-b/) | 32×32 | 7 | 710ms | once |  | 이펙트 — 폭죽 B — 흰 점 → 노란 마름모 고리가 퍼지며 끝이 붉게 바램 (1회, 가운데 기준) |
| `fx-firework-c` | [fx/firework-c](fx/firework-c/) | 32×32 | 7 | 710ms | once |  | 이펙트 — 폭죽 C — 흰 고리 → 노란 고리가 크게 퍼지며 끝이 붉게 바램 (1회, 가운데 기준) |
| `fx-question` | [fx/question](fx/question/) | 16×16 | 13 | 930ms | once |  | 이펙트 — 갸웃 "?" 말풍선 (1회, 고치 머리 위) — 혼비백산 "!" 말풍선 틀에 글자만 ? |
| `fx-leaf` | [fx/leaf](fx/leaf/) | 3×2 | 3 | 360ms | timeline |  | 이펙트 — 나뭇잎 3모양 (0 ／ · 1 ＼ · 2 — 누움) — 숲 탐험 재생표가 장 번호를 정함 |
| `gyulsae-adult-idle` | [gyulsae/adult/idle](gyulsae/adult/idle/) | 32×32 | 17 | 3720ms | loop | ○ | 성체 귤새 — 가만히 (숨쉬기·깜빡임) |
| `gyulsae-adult-panic-a` | [gyulsae/adult/panic-a](gyulsae/adult/panic-a/) | 32×32 | 8 | 400ms | loop | ○ | 성체 귤새 — 혼비백산 달리기 A (반복) |
| `gyulsae-adult-panic-b` | [gyulsae/adult/panic-b](gyulsae/adult/panic-b/) | 32×32 | 6 | 240ms | loop | ○ | 성체 귤새 — 혼비백산 달리기 B (반복) |
| `gyulsae-adult-pet-a` | [gyulsae/adult/pet-a](gyulsae/adult/pet-a/) | 32×32 | 16 | 2290ms | loop | ○ | 성체 귤새 — 쓰담 A 손에 기대 비비기 (누르는 동안 반복) |
| `gyulsae-adult-pet-b` | [gyulsae/adult/pet-b](gyulsae/adult/pet-b/) | 32×32 | 12 | 1160ms | once | ○ | 성체 귤새 — 쓰담 B 손 뗄 때 폴짝 (1회) |
| `gyulsae-adult-startle` | [gyulsae/adult/startle](gyulsae/adult/startle/) | 32×32 | 6 | 380ms | once | ○ | 성체 귤새 — 혼비백산 시작 깜짝 (1회) |
| `gyulsae-adult` | [gyulsae/adult/still](gyulsae/adult/still/) | 32×32 | 1 | 100ms | loop | ○ | 성체 귤새 — 정지 (원본) |
| `gyulsae-adult-waddle` | [gyulsae/adult/waddle](gyulsae/adult/waddle/) | 32×32 | 8 | 880ms | loop | ○ | 성체 귤새 — 뒤뚱 걷기 (날개를 팔처럼) |
| `gyulsae-egg-hop` | [gyulsae/egg/hop](gyulsae/egg/hop/) | 32×32 | 8 | 640ms | loop | ○ | 알 — 통통 |
| `gyulsae-egg-idle-a` | [gyulsae/egg/idle-a](gyulsae/egg/idle-a/) | 32×32 | 7 | 3560ms | loop | ○ | 알 — 가만히 A 꿈틀 |
| `gyulsae-egg-idle-b` | [gyulsae/egg/idle-b](gyulsae/egg/idle-b/) | 32×32 | 5 | 4300ms | loop | ○ | 알 — 가만히 B 갸웃 |
| `gyulsae-egg-panic-a` | [gyulsae/egg/panic-a](gyulsae/egg/panic-a/) | 32×32 | 10 | 450ms | loop | ○ | 알 — 혼비백산 달리기 A (반복) |
| `gyulsae-egg-panic-b` | [gyulsae/egg/panic-b](gyulsae/egg/panic-b/) | 32×32 | 8 | 360ms | loop | ○ | 알 — 혼비백산 달리기 B (반복) |
| `gyulsae-egg-pet-a` | [gyulsae/egg/pet-a](gyulsae/egg/pet-a/) | 32×32 | 19 | 2150ms | loop | ○ | 알 — 쓰담 A 손에 기대 비비기 (누르는 동안 반복) |
| `gyulsae-egg-pet-b` | [gyulsae/egg/pet-b](gyulsae/egg/pet-b/) | 32×32 | 13 | 1090ms | once | ○ | 알 — 쓰담 B 손 뗄 때 폴짝 (1회) |
| `gyulsae-egg-roll` | [gyulsae/egg/roll](gyulsae/egg/roll/) | 32×32 | 16 | 1650ms | loop | ○ | 알 — 구르기 |
| `gyulsae-egg-startle` | [gyulsae/egg/startle](gyulsae/egg/startle/) | 32×32 | 8 | 410ms | once | ○ | 알 — 혼비백산 시작 깜짝 (1회) |
| `gyulsae-egg` | [gyulsae/egg/still](gyulsae/egg/still/) | 32×32 | 1 | 100ms | loop | ○ | 알 — 정지 (원본) |
| `gyulsae-egg-waddle` | [gyulsae/egg/waddle](gyulsae/egg/waddle/) | 32×32 | 8 | 670ms | loop | ○ | 알 — 뒤뚱 걷기 |
| `gyulsae-grow-a` | [gyulsae/grow/a](gyulsae/grow/a/) | 32×32 | 40 | 4895ms | once | ○ | 자라기 (어린 귤새 → 성체 귤새) A 진화 (하얀 실루엣이 번갈며 빨라짐 → 번쩍) |
| `gyulsae-grow-b` | [gyulsae/grow/b](gyulsae/grow/b/) | 32×32 | 19 | 2620ms | once | ○ | 자라기 (어린 귤새 → 성체 귤새) B 쑥쑥 (웅크렸다 배가 한 줄씩 자람 → 새싹 퐁) |
| `gyulsae-grow-c` | [gyulsae/grow/c](gyulsae/grow/c/) | 32×32 | 10 | 1236ms | once | ○ | 자라기 (어린 귤새 → 성체 귤새) C 깜빡 (작은·중간·큰 그림 번갈기, 마리오식) |
| `gyulsae-hatch-a` | [gyulsae/hatch/a](gyulsae/hatch/a/) | 32×32 | 34 | 4420ms | once | ○ | 부화 (알 → 어린 귤새) A 번쩍 (포켓몬식) |
| `gyulsae-hatch-b` | [gyulsae/hatch/b](gyulsae/hatch/b/) | 32×32 | 52 | 6440ms | once | ○ | 부화 (알 → 어린 귤새) B 뚜껑 퐁 (병아리식) |
| `gyulsae-juvenile-fly` | [gyulsae/juvenile/fly](gyulsae/juvenile/fly/) | 32×32 | 7 | 720ms | loop | ○ | 어린 귤새 — 날기 — 반복 부분만 (앞에 takeoff 1회, 뒤에 land 1회를 붙여 재생) |
| `gyulsae-juvenile-fly-struggle` | [gyulsae/juvenile/fly-struggle](gyulsae/juvenile/fly-struggle/) | 32×32 | 19 | 990ms | loop | ○ | 어린 귤새 — 빨빨 날기 — 반복 부분만 (앞에 takeoff 1회, 뒤에 land 1회를 붙여 재생) |
| `gyulsae-juvenile-idle` | [gyulsae/juvenile/idle](gyulsae/juvenile/idle/) | 32×32 | 17 | 3480ms | loop | ○ | 어린 귤새 — 가만히 (숨쉬기·깜빡임) |
| `gyulsae-juvenile-land` | [gyulsae/juvenile/land](gyulsae/juvenile/land/) | 32×32 | 6 | 630ms | once | ○ | 어린 귤새 — 착지 (날기 뒤, 1회) |
| `gyulsae-juvenile-panic-a` | [gyulsae/juvenile/panic-a](gyulsae/juvenile/panic-a/) | 32×32 | 8 | 360ms | loop | ○ | 어린 귤새 — 혼비백산 달리기 A (반복) |
| `gyulsae-juvenile-panic-b` | [gyulsae/juvenile/panic-b](gyulsae/juvenile/panic-b/) | 32×32 | 12 | 520ms | loop | ○ | 어린 귤새 — 혼비백산 달리기 B (반복) |
| `gyulsae-juvenile-pet-a` | [gyulsae/juvenile/pet-a](gyulsae/juvenile/pet-a/) | 32×32 | 16 | 2100ms | loop | ○ | 어린 귤새 — 쓰담 A 손에 기대 비비기 (누르는 동안 반복) |
| `gyulsae-juvenile-pet-b` | [gyulsae/juvenile/pet-b](gyulsae/juvenile/pet-b/) | 32×32 | 11 | 1110ms | once | ○ | 어린 귤새 — 쓰담 B 손 뗄 때 폴짝 (1회) |
| `gyulsae-juvenile-startle` | [gyulsae/juvenile/startle](gyulsae/juvenile/startle/) | 32×32 | 7 | 420ms | once | ○ | 어린 귤새 — 혼비백산 시작 깜짝 (1회) |
| `gyulsae-juvenile` | [gyulsae/juvenile/still](gyulsae/juvenile/still/) | 32×32 | 1 | 100ms | loop | ○ | 어린 귤새 — 정지 (원본) |
| `gyulsae-juvenile-takeoff` | [gyulsae/juvenile/takeoff](gyulsae/juvenile/takeoff/) | 32×32 | 5 | 550ms | once | ○ | 어린 귤새 — 이륙 (날기 앞, 1회) |
| `sea` | [sea/still](sea/still/) | 32×32 | 1 | 1000ms | loop |  | 바다 — 정지 (디자이너 원본 한 장) |
| `sea-v4-b` | [sea/sway](sea/sway/) | 32×32 | 32 | 3520ms | loop |  | 바다 — 일렁임 (선 그물이 너울 타고 0/1칸 — 디자이너 색만, 반짝이 없음) |
| `ash-l1` | [volcano/ash-cover/l1](volcano/ash-cover/l1/) | 112×112 | 40 | 2000ms | timeline |  | 섬 넓히기 화산재 덩이 L1 — 혼자 재생 안 함, timeline.json 이 장마다 몇 번 그림을 어디 놓을지 고름. 0 = 꽉 참 · 1~7 = 나타남(작게→크게) · 8~13/14~19/20~25/26~31 = 왼·오른·위·아래 쪽으로 흩어짐 · 32~39 = 0~7 의 그늘 테 없는 판(안쪽 덩이용) |
| `ash-l2` | [volcano/ash-cover/l2](volcano/ash-cover/l2/) | 112×112 | 40 | 2000ms | timeline |  | 섬 넓히기 화산재 덩이 L2 — 혼자 재생 안 함, timeline.json 이 장마다 몇 번 그림을 어디 놓을지 고름. 0 = 꽉 참 · 1~7 = 나타남(작게→크게) · 8~13/14~19/20~25/26~31 = 왼·오른·위·아래 쪽으로 흩어짐 · 32~39 = 0~7 의 그늘 테 없는 판(안쪽 덩이용) |
| `ash-m1` | [volcano/ash-cover/m1](volcano/ash-cover/m1/) | 72×72 | 40 | 2000ms | timeline |  | 섬 넓히기 화산재 덩이 M1 — 혼자 재생 안 함, timeline.json 이 장마다 몇 번 그림을 어디 놓을지 고름. 0 = 꽉 참 · 1~7 = 나타남(작게→크게) · 8~13/14~19/20~25/26~31 = 왼·오른·위·아래 쪽으로 흩어짐 · 32~39 = 0~7 의 그늘 테 없는 판(안쪽 덩이용) |
| `ash-m2` | [volcano/ash-cover/m2](volcano/ash-cover/m2/) | 72×72 | 40 | 2000ms | timeline |  | 섬 넓히기 화산재 덩이 M2 — 혼자 재생 안 함, timeline.json 이 장마다 몇 번 그림을 어디 놓을지 고름. 0 = 꽉 참 · 1~7 = 나타남(작게→크게) · 8~13/14~19/20~25/26~31 = 왼·오른·위·아래 쪽으로 흩어짐 · 32~39 = 0~7 의 그늘 테 없는 판(안쪽 덩이용) |
| `ash-s1` | [volcano/ash-cover/s1](volcano/ash-cover/s1/) | 40×40 | 40 | 2000ms | timeline |  | 섬 넓히기 화산재 덩이 S1 — 혼자 재생 안 함, timeline.json 이 장마다 몇 번 그림을 어디 놓을지 고름. 0 = 꽉 참 · 1~7 = 나타남(작게→크게) · 8~13/14~19/20~25/26~31 = 왼·오른·위·아래 쪽으로 흩어짐 · 32~39 = 0~7 의 그늘 테 없는 판(안쪽 덩이용) |
| `volcano-erupt-a` | [volcano/erupt-a](volcano/erupt-a/) | 96×128 | 39 | 2600ms | once |  | 화산 — 분출 A 펑 |
| `volcano-erupt-ash-full` | [volcano/erupt-ash-full](volcano/erupt-ash-full/) | 96×128 | 18 | 3240ms | once |  | 화산 — 섬 넓히기용 화산재 분출 (1회) |
| `volcano-erupt-b` | [volcano/erupt-b](volcano/erupt-b/) | 96×128 | 38 | 2600ms | once |  | 화산 — 분출 B 퐁퐁 |
| `volcano-idle-a` | [volcano/idle-a](volcano/idle-a/) | 96×128 | 70 | 10560ms | loop |  | 화산 — 가만히 A 모락모락 |
| `volcano-idle-b` | [volcano/idle-b](volcano/idle-b/) | 96×128 | 30 | 14080ms | loop |  | 화산 — 가만히 B 퐁 |
| `volcano` | [volcano/still](volcano/still/) | 96×128 | 1 | 1000ms | loop |  | 화산 — 정지 (디자이너 원본) |
