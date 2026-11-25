"""숲 탐험 순서(route) 만들기 → data/route_c3.json  (캐릭터와 무관 — 어떤 캐릭터든 이 순서로 탐험)

  python -I -X utf8 make_route.py

좌표는 숲 그림 칸(192×128) 기준. x = 캐릭터 가운데, F = 발 높이(땅 y).
character: 캐릭터가 하는 일(시간순)
  walk   {t, path:[[x,F],...], stepMs}        1칸씩 걷기 — 숲 안(F<outsideFrom)이면 잎 사이로 머리만, 가는 쪽을 보며 가끔 반대쪽 힐끗
  stand  {t, x, F, durMs, look:[[ms,lv]...], bubbleAt}   서서 두리번(lv -2..2) · bubbleAt ms 에 "?"
  dig    {t, x, F, durMs}                     잎에 머리를 박고 뒤적
  dive   {t, from:[x,F], to:[x,F], durMs, sink, rise}   쏙 잠겨 이동 → 올라옴
  under  {t, x, F0, F1, durMs, stepMs}        앞쪽 덤불 밑으로 걸어 나오기(F0<F1)/들어가기
  shake  {t, x, F, durMs}                     옆 나무 줄기를 쿵·쿵·쿵
fx: 그때 숲에 일어나는 일 — rustles(부스럭 타원) · shakes(나무 머리 흔들기 + 칸 이동 순서) · leaves(잎 튐)
scene: 숲에 따른 값 — underY(앞쪽 덤불 아랫선) · outsideFrom(이 발 높이부터 숲 밖 땅)
"""
import json, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FW = 192
UNDER_Y = 100
SHAKE_SEQ = [[2, 0], [-2, 0], [2, -1], [-1, 0], [1, 0], [-1, 0], [0, 0]]
SHAKE_BIG = [[3, 0], [-3, -1], [2, 0], [-2, 0], [2, -1], [-1, 0], [1, 0], [-1, 0], [0, 0]]
LOOK_LR = [[200, -2], [650, -1], [750, 2], [1200, 1], [1300, 0]]
LOOK_RL = [[200, 2], [650, 1], [750, -2], [1200, -1], [1300, 0]]

def build():
    ch, rustles, shakes, leaves = [], [], [], []
    t = 0
    cur = dict(x=40, F=66)
    def rustle(t0, t1, cx, cy, rx, ry): rustles.append(dict(t0=t0, t1=t1, cx=cx, cy=cy, rx=rx, ry=ry))
    def nleaf(): return sum(l['n'] for l in leaves)      # 지금까지 튄 잎 수 (잎 모양 seed 에 씀)
    def leaf(t0, x, y, n, seed, floor, up, spread):
        leaves.append(dict(t=int(t0), x=round(float(x), 2), y=round(float(y), 2), n=n, seed=seed, floor=floor, up=list(up), spread=spread))
    def sprinkle(t0, x, F, n, seed): leaf(t0, int(x), F - 16, n, seed, F - 4, (100, 130), 30)
    def path_to(pts):
        pts = [(cur['x'], cur['F'])] + pts; path = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0))
            for k in range(n): path.append([round(x0 + (x1 - x0) * k / n, 2), round(y0 + (y1 - y0) * k / n, 2)])
        return path, pts[-1]
    def walk(pts, step=45):
        nonlocal t
        path, end = path_to(pts)
        ch.append(dict(kind='walk', t=t, path=path, stepMs=step))
        t += len(path) * step; cur.update(x=end[0], F=end[1])
    def stand(dur, look, bubble_at=None):
        nonlocal t
        ch.append(dict(kind='stand', t=t, x=cur['x'], F=cur['F'], durMs=dur, look=look, bubbleAt=bubble_at)); t += dur
    def dig(dur=1800):
        nonlocal t
        x, F = cur['x'], cur['F']
        ch.append(dict(kind='dig', t=t, x=x, F=F, durMs=dur))
        rustle(t + 150, t + dur - 150, x, F - 12, 14, 6)
        sprinkle(t + 200, x - 6, F, 1, 900 + nleaf())
        sprinkle(t + 900, x + 8, F, 1, 910 + nleaf())
        t += dur
    def dive(x1, F1, step=22, sink=True, rise=True):
        nonlocal t
        x0, F0 = cur['x'], cur['F']
        n = max(abs(x1 - x0), abs(F1 - F0)); dur = 160 + n * step + 160
        ch.append(dict(kind='dive', t=t, **{'from': [x0, F0]}, to=[x1, F1], durMs=dur, sink=sink, rise=rise))
        rustle(t, t + 260, x0, F0 - 12, 14, 6)
        rustle(t + dur - 220, t + dur + 60, x1, F1 - 12, 14, 6)
        sprinkle(t + 60, x0, F0, 2, 950 + nleaf())
        for k in range(1, max(2, (n * step) // 400)):
            u = k * 400 / max(1, n * step)
            if u < 1: sprinkle(t + 160 + k * 400, x0 + (x1 - x0) * u, F0 + (F1 - F0) * u, 2, 960 + nleaf())
        sprinkle(t + dur - 120, x1, F1, 2, 990 + nleaf())
        t += dur; cur.update(x=x1, F=F1)
    def under(F0, F1, step=50):
        nonlocal t
        x = cur['x']; n = abs(F1 - F0)
        ch.append(dict(kind='under', t=t, x=x, F0=F0, F1=F1, durMs=n * step, stepMs=step))
        rustle(t, t + n * step, x, UNDER_Y - 6, 15, 6)
        leaf(t + (60 if F1 > F0 else n * step - 200), x, UNDER_Y - 4, 2, 1100 + nleaf(), UNDER_Y + 12, (50, 80), 36)
        t += n * step; cur['F'] = F1
    def shake_tree(tx, ty, rx, ry):
        nonlocal t
        x, F = cur['x'], cur['F']
        ch.append(dict(kind='shake', t=t, x=x, F=F, durMs=2700, tree=[tx, ty]))
        for k in range(3):
            hit = t + 300 + k * 750 + 160
            shakes.append(dict(t=hit, cx=tx, cy=ty, rx=rx, ry=ry, seq=SHAKE_BIG if k == 2 else SHAKE_SEQ))
            rng = np.random.default_rng(1300 + k)
            for j in range(3 if k < 2 else 6):
                lx = int(tx + rng.uniform(-rx * 0.8, rx * 0.8)); ly = int(ty + rng.uniform(-ry * 0.3, ry * 0.6))
                leaf(hit + j * 50, lx, ly, 1, 1310 + k * 10 + j, F - 1, (10, 40), 20)
        t += 2700

    # ── 숲 속: 가운데 줄(발 66) 왼쪽에서 가운데로 → 두리번 → 뒤적 → 두리번 "?"
    walk([(92, 66)])
    stand(1500, LOOK_LR)
    dig()
    stand(1400, LOOK_RL, 350)
    # ── 쏙 잠겨 뒷줄(48)로 → 오른쪽으로 → 두리번
    dive(110, 48)
    walk([(150, 48)])
    stand(1500, LOOK_RL)
    # ── 쏙 잠겨 앞줄(84) 가운데로 → 왼쪽으로 → 뒤적 → "?"
    dive(128, 84)
    walk([(78, 84)])
    dig()
    stand(1400, LOOK_LR, 350)
    # ── 가끔 바깥: 잠긴 채 앞쪽 덤불까지 → 덤불 밑으로 걸어 나옴 → 옆 나무 쿵쿵쿵 → "?" → 다시 덤불 밑으로
    dive(156, 84, rise=False)
    cur['F'] = UNDER_Y
    under(UNDER_Y, 113)
    walk([(153, 110)])
    shake_tree(135, 88, 21, 16)
    stand(1300, [[150, -2], [500, 2], [850, 0]], 250)
    walk([(156, 113)])
    under(113, UNDER_Y)
    cur['F'] = 84
    dive(120, 66, sink=False)
    # ── 다시 숲 속: 뒷줄 왼쪽 → 두리번 → 처음 자리로
    dive(60, 48)
    walk([(30, 48)])
    stand(1300, LOOK_RL)
    dive(40, 66)
    # 넘겨주기 자리: 탐험 시간이 끝나면 앱은 다음 '넘겨주기' 시각까지 반복을 이어 가다가 찾기 장면(route_found)으로 바꿈.
    # 모두 캐릭터가 잎 속에 완전히 잠겨 안 보이는 순간(쏙 잠겨 이동하는 중간)이라 바꿔도 튀지 않음. 최대 약 8초 간격.
    handoffs = []
    for c in ch:
        if c['kind'] == 'dive' and c['durMs'] >= 500:
            u = 0.5; tm = c['t'] + 160 + int((c['durMs'] - 320) * u)
            (x0, F0), (x1, F1) = c['from'], c['to']
            handoffs.append(dict(t=tm, x=round(x0 + (x1 - x0) * u), F=round(F0 + (F1 - F0) * u)))
    return dict(format='gachi-forest-explore/1',
                note='숲 탐험 C안(3차) — 숲 속(가운데 포함)을 돌아다니며 두리번·뒤적, 가끔 바깥으로 나와 나무 흔들기. 끝없이 반복.',
                forest='forest.png', size=[FW, 128], loopMs=t,
                scene=dict(underY=UNDER_Y, outsideFrom=100),
                handoffs=handoffs,
                character=ch, fx=dict(rustles=rustles, shakes=shakes, leaves=leaves))

def build_found():
    """찾기 장면 (탐험 끝, 1회 + 마지막 자세 반복). 시작 = 넘겨주기 자리(잠겨 안 보임) — 첫 travel 의 from 은 앱이 채움.
    물건 그림은 정해지지 않음(랜덤) → item 칸: 어떤 크기 그림이든 머리 위에 바닥 가운데를 맞춰 올림."""
    ch, rustles, leaves, fireworks, bubbles = [], [], [], [], []
    X, F, G = 96, 84, 124                      # 찾는 자리(숲 앞줄 가운데) · 뛰어나와 내려앉을 땅
    t = 0
    def leaf(t0, x, y, n, seed, floor, up, spread):
        leaves.append(dict(t=int(t0), x=x, y=y, n=n, seed=seed, floor=floor, up=list(up), spread=spread))
    # 1) 잠긴 채 찾는 자리로 (0.7초, 머리 위 숲이 따라 들썩)
    ch.append(dict(kind='travel', t=t, **{'from': None}, to=[X, F], durMs=700)); t += 700
    # 2) 여기다! 덤불이 크게 들썩 · 잎이 연달아 튐 (잠긴 채)
    ch.append(dict(kind='hidden', t=t, x=X, F=F, durMs=900))
    rustles.append(dict(t0=t, t1=t + 900, cx=X, cy=F - 12, rx=18, ry=8))
    for k in range(5): leaf(t + 80 + k * 170, X + (-8, 8, -3, 10, -10)[k], F - 16, 2, 2000 + k, F - 4, (100, 140), 34)
    t += 900
    # 3) 쏙 튀어 올라와 깜짝 + "!"
    ch.append(dict(kind='popup', t=t, x=X, F=F, durMs=800))
    bubbles.append(dict(t=t + 80, kind='bang', holdMs=220))       # 고치가 다시 잠기기 전(0.8초 안)에 다 사라짐
    rustles.append(dict(t0=t, t1=t + 260, cx=X, cy=F - 12, rx=16, ry=7))
    leaf(t + 40, X, F - 16, 3, 2100, F - 4, (110, 150), 40)
    t += 800
    # 4) 덥석 (잎 속에 머리를 넣어 집음)
    ch.append(dict(kind='dig', t=t, x=X, F=F, durMs=600))
    rustles.append(dict(t0=t + 100, t1=t + 500, cx=X, cy=F - 12, rx=14, ry=6))
    t += 600
    # 5) 숲 밖으로 폴짝 뛰어나와(화면 앞쪽) 내려앉음
    ch.append(dict(kind='jump', t=t, **{'from': [X, F]}, to=[X, G], durMs=650, height=40))
    leaf(t + 40, X, F - 16, 4, 2200, F - 4, (120, 160), 44)
    t += 650
    ch.append(dict(kind='land', t=t, x=X, F=G, durMs=220)); t += 220
    # 6) 물건이 머리 위로 솟음 + 폭죽
    ch.append(dict(kind='reveal', t=t, x=X, F=G, durMs=700))
    item_t = t
    fireworks.append(dict(t=t + 180, kind='c', dx=0, dy=0))
    t += 700
    # 7) 신나서 폴짝 (쓰담 B 동작) + 양옆 폭죽
    ch.append(dict(kind='cheer', t=t, x=X, F=G))
    fireworks.append(dict(t=t + 150, kind='a', dx=-14, dy=4))
    fireworks.append(dict(t=t + 420, kind='b', dx=13, dy=-2))
    t += 1200
    # 8) 마지막 자세: 물건을 머리에 이고 숨쉬기 · 물건 반짝 (여기부터 holdMs 동안을 계속 반복)
    hold_from = t
    ch.append(dict(kind='hold', t=t, x=X, F=G, durMs=2800))
    fireworks.append(dict(t=t + 500, kind='b', dx=-9, dy=-6))
    fireworks.append(dict(t=t + 1900, kind='b', dx=10, dy=-9))
    t += 2800
    return dict(format='gachi-forest-explore/1',
                note='숲 탐험 끝 — 찾기 장면. 넘겨주기 자리(잠김)에서 시작 → 덤불 들썩 → 쏙 깜짝 "!" → 덥석 → 숲 밖으로 폴짝 → 물건이 머리 위로 + 폭죽 → 폴짝폴짝 → 물건을 이고 반복.',
                forest='forest.png', size=[FW, 128], loopMs=t, holdFrom=hold_from,
                scene=dict(underY=UNDER_Y, outsideFrom=100),
                item=dict(appearAt=item_t, anchor='머리 꼭대기 위 1칸에 물건 그림 바닥 가운데', maxSize=[32, 32]),
                character=ch, fx=dict(rustles=rustles, shakes=[], leaves=leaves, fireworks=fireworks, bubbles=bubbles))

def build_intro(loop):
    """탐험 시작 (1회). 귤새는 섬을 돌아다니다가 숲 앞 '도착 지점(entry)'까지 섬의 평소 걷기로 걸어옴(앱 몫)
    → 여기서부터: 숲을 보며 두리번 → 웅크렸다 숲으로 폴짝 뛰어듦(잎에 잠기며 잎 튐)
    → 쏙 잠겨 반복 장면 첫 자리로 가서 올라옴 = 반복(loop.json) 0ms 와 같은 자리·같은 모습 → 바로 이어짐"""
    ch, rustles, leaves = [], [], []
    t = 0
    def leaf(t0, x, y, n, seed, floor, up, spread):
        leaves.append(dict(t=int(t0), x=x, y=y, n=n, seed=seed, floor=floor, up=list(up), spread=spread))
    X, G = 64, 124                                     # 도착 지점: 숲 앞 땅 (앞줄 소나무들보다 앞)
    start = loop['character'][0]['path'][0]           # 반복 장면 첫 자리 [x, F]
    # 2) 숲을 보며 두리번
    ch.append(dict(kind='stand', t=t, x=X, F=G, durMs=1400, look=[[150, -2], [550, -1], [650, 2], [1050, 1], [1150, 0]], bubbleAt=None)); t += 1400
    # 3) 읏차 — 웅크림
    ch.append(dict(kind='ready', t=t, x=X, F=G, durMs=260)); t += 260
    # 4) 숲으로 폴짝 (공중에선 다 보임 → 내려앉으며 잎에 잠김)
    JF = (52, 84)
    ch.append(dict(kind='jump', t=t, **{'from': [X, G]}, to=list(JF), durMs=650, height=40, into=True))
    land = t + 650
    rustles.append(dict(t0=land - 60, t1=land + 300, cx=JF[0], cy=JF[1] - 12, rx=16, ry=7))
    leaf(land - 40, JF[0], JF[1] - 16, 4, 3000, JF[1] - 4, (110, 150), 40)
    t += 650
    # 5) 쏙 잠겨 반복 장면 첫 자리로 → 올라옴
    x1, F1 = int(round(start[0])), int(round(start[1]))
    n = max(abs(x1 - JF[0]), abs(F1 - JF[1])); dur = 160 + n * 22 + 160
    ch.append(dict(kind='dive', t=t, **{'from': list(JF)}, to=[x1, F1], durMs=dur, sink=True, rise=True))
    rustles.append(dict(t0=t + dur - 220, t1=t + dur + 60, cx=x1, cy=F1 - 12, rx=14, ry=6))
    leaf(t + dur - 120, x1, F1 - 16, 2, 3010, F1 - 4, (100, 130), 30)
    t += dur
    return dict(format='gachi-forest-explore/1',
                note='숲 탐험 시작 (1회) — 도착 지점에서 두리번 → 숲으로 폴짝 → 잠겨서 반복 장면 첫 자리로. 끝나면 loop.json 0ms 부터.',
                forest='forest.png', size=[FW, 128], loopMs=t, next='loop.json',
                entry=dict(x=X, F=G, coords='숲 그림 왼쪽 위 기준 칸(x = 캐릭터 가운데, F = 발 높이). 섬 좌표 = 숲이 놓인 자리 + 이 값',
                           howTo='섬을 돌아다니던 귤새를 섬의 평소 걷기(waddle 등)로 이 자리까지 데려온 뒤(오는 방향 자유) 정면을 보고 서면 intro 0ms 부터 재생'),
                scene=dict(underY=UNDER_Y, outsideFrom=100),
                character=ch, fx=dict(rustles=rustles, shakes=[], leaves=leaves))

def build_leave(found, intro):
    """떠나기 (1회): 찾기 장면 마지막 자세(물건을 머리에 임)에서 시작 — 보상 화면을 닫은 뒤.
    물건을 쏙 챙김(머리 뒤로 내려가며 반짝) → 숲을 둘러봄 → 폴짝 → 떠나는 지점(exit)까지 걸어감 → 앱이 섬 걷기로 이어 감"""
    last = found['character'][-1]                     # 마지막 자세 자리
    X, G = last['x'], last['F']
    EX, EF = intro['entry']['x'], intro['entry']['F']  # 떠나는 지점 = 들어올 때 도착 지점 (섬 길과 이어지는 자리)
    ch, fireworks = [], []
    t = 0
    ch.append(dict(kind='stand', t=t, x=X, F=G, durMs=500, look=[], bubbleAt=None))
    fireworks.append(dict(t=t + 160, kind='b', dx=0, dy=-2))
    t += 500
    ch.append(dict(kind='stand', t=t, x=X, F=G, durMs=1000, look=[[100, -2], [450, -1], [520, 2], [870, 0]], bubbleAt=None)); t += 1000
    ch.append(dict(kind='hop', t=t, x=X, F=G, durMs=320, height=4)); t += 320
    n = abs(EX - X)
    path = [[X + (EX - X) * k / n, G + (EF - G) * k / n] for k in range(n + 1)]
    ch.append(dict(kind='walk', t=t, path=path, stepMs=45)); t += len(path) * 45
    return dict(format='gachi-forest-explore/1',
                note='숲 탐험 떠나기 (1회) — 찾기 장면 마지막 자세에서: 물건 쏙 챙김 → 숲 둘러봄 → 폴짝 → 떠나는 지점까지 걸어감. 그다음은 앱이 섬 걷기로.',
                forest='forest.png', size=[FW, 128], loopMs=t, prev='find.json',
                scene=dict(underY=UNDER_Y, outsideFrom=100),
                item=dict(onHeadAtStart=True, hideMs=260, note='시작할 때 머리 위 물건이 260ms 동안 머리 뒤로 내려가며 사라짐(챙김) + 반짝'),
                exit=dict(x=EX, F=EF, coords='숲 그림 왼쪽 위 기준 칸 — 여기서 섬의 평소 걷기로 이어 감(가는 방향 자유)'),
                character=ch, fx=dict(rustles=[], shakes=[], leaves=[], fireworks=fireworks))

def save(obj, rel):
    p = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'scenes', 'forest-explore', 'source', 'scenes', rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(obj, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    r = build(); save(r, 'explore/loop.json')
    print('평소 탐험 반복', r['loopMs'], 'ms · 넘겨주기', [h['t'] for h in r['handoffs']])
    i = build_intro(r); save(i, 'explore/intro.json')
    print('평소 탐험 시작', i['loopMs'], 'ms')
    f = build_found(); save(f, 'find/find.json')
    print('물건 찾기', f['loopMs'], 'ms · 마지막 자세 반복', f['holdFrom'], '~')
    lv = build_leave(f, i); save(lv, 'find/leave.json')
    print('떠나기', lv['loopMs'], 'ms · 떠나는 지점', lv['exit']['x'], lv['exit']['F'])
