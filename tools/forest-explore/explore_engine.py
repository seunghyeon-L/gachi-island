"""숲 탐험 엔진 — 숲(장면) · 탐험 순서(route JSON) · 캐릭터(characters.json)를 따로 두고 합쳐서 그림.

  python -I -X utf8 explore_engine.py [--char adult|juvenile|all] [--route data/route_c3.json]

나누어 둔 것:
  1) 숲 장면  — 숲 그림 한 장 + 부스럭·나무 흔들기·잎·덤불 윗머리 띠 (캐릭터와 무관)
  2) 탐험 순서 — data/route_c3.json (make_route.py 가 만듦): 걷는 길·멈춤·두리번·잠기기·뒤적·덤불 밑·나무 흔들기와
                 그때 숲에 일어나는 일(부스럭·흔들림·잎). 캐릭터와 무관 → 어떤 캐릭터든 같은 순서로 탐험.
  3) 캐릭터   — data/characters.json: 쓸 동작 폴더(idle·walk) + 몸 치수(발·눈·머리 꼭대기 줄, 얼굴 칸, 몸 색).
                 잎에 잠기는 깊이·두리번(얼굴 옮기기)·말풍선 자리가 이 치수로 정해짐.
원칙: 디자이너 숲·캐릭터 그림은 그대로(색·모양 안 바꿈) — 움직임은 정수 칸 이동·가리기·얼굴 칸 옮기기만,
      잎·"?"·덤불 윗머리 띠는 숲·말풍선 원래 색만 쓰는 이펙트.
"""
import json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))                         # gachi-island 저장소
PKG = os.path.join(REPO, 'assets', 'scenes', 'forest-explore')       # 프론트에 넘기는 묶음
DATA = os.path.join(PKG, 'source')                                    # 만드는 데 쓰는 원본: characters.json · items · scenes/
PREVIEW = os.path.join(REPO, 'tools', 'forest-explore', 'preview')    # 미리보기 GIF (확인용 · 커밋 안 함)
ANIM = os.path.join(REPO, 'assets', 'animations') + '/'
TICK = 40                                   # 미리보기 샘플 간격(ms)
MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM = 34, 30, 14

def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)] + [255], np.uint8)
def ease_out(u): return 1 - (1 - u) ** 2
def ease_in(u): return u * u
def lerp(a, b, u): return a + (b - a) * u

def blit(dst, spr, x, y, mask=None):
    h, w = spr.shape[:2]
    x0, y0 = max(x, 0), max(y, 0); x1, y1 = min(x + w, dst.shape[1]), min(y + h, dst.shape[0])
    if x0 >= x1 or y0 >= y1: return
    s = spr[y0 - y:y1 - y, x0 - x:x1 - x]
    m = s[..., 3] > 0
    if mask is not None: m &= mask[y0:y1, x0:x1]
    dst[y0:y1, x0:x1][m] = s[m]

def load_anim(path):
    a = json.load(open(ANIM + path + '/anim.json', encoding='utf-8'))
    s = np.array(Image.open(ANIM + path + '/' + a['sheet']).convert('RGBA'))
    sh = np.array(Image.open(ANIM + path + '/' + a['shadow']).convert('RGBA')) if a.get('shadow') else None
    w = a['frameWidth']
    fr = [s[:, i * w:(i + 1) * w] for i in range(a['frameCount'])]
    sf = [sh[:, i * w:(i + 1) * w] for i in range(a['frameCount'])] if sh is not None else [None] * len(fr)
    return a, fr, sf

# ═══════════════════ 1) 숲 장면 ═══════════════════
class Forest:
    BROWN = {(0x4a, 0x40, 0x35), (0x6f, 0x60, 0x4c), (0x5f, 0x52, 0x42), (0x86, 0x74, 0x5a)}
    GRASS = {(0x5c, 0xa0, 0x5b)}
    RUSTLE_CYCLE = [(1, -1), (0, -2), (-1, -1), (0, 0)]                     # 부스럭: 위로 들썩이며 좌우로 (70ms 씩)
    ARC = np.array([2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2])           # 덤불 윗머리 아치 (덤불 하나 16칸)
    BUMP = [0, 1, 2, 2, 2, 1, 0, 0, 1, 1]                                   # 덤불 아랫단 물결
    C_TOP, C_HI, C_MID, EDGE = hexc('#86cc78'), hexc('#a2d98a'), hexc('#6dbf6a'), hexc('#357f50')   # 숲 그림 색 그대로

    def __init__(self, path):
        self.img = np.array(Image.open(path).convert('RGBA'))
        self.H, self.W = self.img.shape[:2]
        self.yy, self.xx = np.mgrid[0:self.H, 0:self.W]

    def foliage(self, f):
        m = f[..., 3] > 0
        for c in self.BROWN | self.GRASS: m &= ~(f[..., :3] == np.array(c)).all(-1)
        return m

    def opaque_at(self, x, y):
        return 0 <= y < self.H and 0 <= x < self.W and self.img[y, x, 3] > 0

    def _shift(self, f, dx, dy):
        src = np.zeros_like(f)
        ys0, ys1 = max(0, dy), self.H + min(0, dy); xs0, xs1 = max(0, dx), self.W + min(0, dx)
        src[ys0:ys1, xs0:xs1] = f[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        return src

    def at(self, ms, rustles, shakes, follow=None):
        """이 시각의 숲 그림: 부스럭(타원 안을 1~2칸 흔듦) · 따라다니는 부스럭 · 나무 머리 흔들기"""
        f = self.img.copy()
        items = [(r['t0'], r['t1'], r['cx'], r['cy'], r['rx'], r['ry']) for r in rustles if r['t0'] <= ms < r['t1']]
        if follow: items.append((0, 0, follow[0], follow[1], 11, 7))
        for (t0, t1, cx, cy, rx, ry) in items:
            k = int((ms - t0) // 70); dx, dy = self.RUSTLE_CYCLE[k % 4]
            if (dx, dy) == (0, 0): continue
            src = self._shift(f, dx, dy)
            m = ((self.xx - cx) / rx) ** 2 + ((self.yy - cy) / ry) ** 2 <= 1
            f[m] = src[m]
        for sk in shakes:
            k = int((ms - sk['t']) // 60)
            if not (0 <= k < len(sk['seq'])): continue
            dx, dy = sk['seq'][k]
            if (dx, dy) == (0, 0): continue
            src = self._shift(f, dx, dy)
            e = ((self.xx - sk['cx']) / sk['rx']) ** 2 + ((self.yy - sk['cy']) / sk['ry']) ** 2 <= 1
            m = (e & self.foliage(f)) | (e & (src[..., 3] > 0) & ~(f[..., 3] > 0))       # 잎만 흔들림 (줄기·풀은 그대로)
            f[m] = src[m]
        return f

    def cap_color(self, row, i):
        if row == 1 and 5 <= i <= 9: return self.C_HI
        return self.C_TOP if row <= 2 else self.C_MID

# ── 잎 (숲 색 두 개)
LD, LL = hexc('#327a4e'), hexc('#a2d98a'); _Z = 0 * LD
LEAF = [np.array([[_Z, LL, LL], [LD, LL, _Z]]), np.array([[LL, LL, _Z], [_Z, LL, LD]]), np.array([[LD, LL, LL]])]
def leaf_path(x0, y0, vx, vy, seed, y_floor, life=1.6):
    rng = np.random.default_rng(seed)
    pts = []; x, y = x0, y0; t = 0
    ph = rng.uniform(0, 6.28); amp = rng.uniform(1.0, 2.2)
    while t < life * 1000:
        dt = 0.02
        vy = min(vy + 260 * dt, 16 + 4 * rng.random()) if vy > 0 else vy + 260 * dt
        vx *= 0.92
        x += vx * dt; y += vy * dt
        pts.append((x + (amp * math.sin(ph + t / 1000 * 7) if vy > 0 else 0), y))
        t += 20
        if y >= y_floor: break
    return pts
class Leaves:
    def __init__(self, bursts):
        self.list = []
        for b in bursts:
            rng = np.random.default_rng(b['seed'])
            for k in range(b['n']):
                vx = rng.uniform(-b['spread'], b['spread']); vy = -rng.uniform(*b['up'])
                self.list.append((b['t'] + k * 40, leaf_path(b['x'], b['y'], vx, vy, b['seed'] * 31 + k, b['floor']), int(rng.integers(0, 3))))
    def draw(self, img, ms, L, ox, oy):
        for t0, pts, kind in self.list:
            for base in (t0, t0 - L):
                i = int((ms - base) // 20)
                if 0 <= i < len(pts):
                    x, y = pts[i]
                    shp = LEAF[(i // 5) % 3 if kind == 2 else (i // 6) % 2]
                    blit(img, shp, ox + int(round(x)), oy + int(round(y)))

# ── "?" 말풍선 (혼비백산 "!" 말풍선 틀에 글자만 ?)
BANG_A, BANG, _ = load_anim('fx/panic-bang')
RED, DRED, PAPER = (0xe8, 0x46, 0x2a), (0xb8, 0x32, 0x1c), (0xff, 0xfa, 0xf0)
Q_GLYPH = ['.cccc.', 'cc..cc', '....cc', '..ccc.', '..dd..', '......', '..cc..', '..dd..']
def _q_bubble():
    out = []
    for f in BANG:
        f = f.copy()
        mark = np.zeros(f.shape[:2], bool)
        for c in (RED, DRED): mark |= (f[..., :3] == c).all(-1) & (f[..., 3] > 0)
        ys, xs = np.nonzero(mark)
        f[mark, :3] = PAPER
        if len(ys) and ys.max() - ys.min() >= 6:
            by, cx = ys.max(), (xs.min() + xs.max() + 1) // 2
            for r, row in enumerate(Q_GLYPH):
                for c, ch in enumerate(row):
                    if ch != '.': f[by - (len(Q_GLYPH) - 1) + r, cx - 3 + c, :3] = RED if ch == 'c' else DRED
        out.append(f)
    return out
QB, QB_PIV = _q_bubble(), BANG_A.get('pivot', [8, 16])
def q_frame(ms, hold=350):
    d = list(BANG_A['durationsMs']); d[8] = hold
    for i, x in enumerate(d):
        if ms < x: return i
        ms -= x
    return None

class FX:
    """한 번 재생하는 이펙트 시트 (폭죽 a·b·c) — 가운데 기준"""
    def __init__(self, path):
        self.a, self.fr, _ = load_anim(path)
    def frame(self, ms):
        for i, d in enumerate(self.a['durationsMs']):
            if ms < d: return self.fr[i]
            ms -= d
        return None
FIREWORK = {k: FX(f'fx/firework-{k}') for k in 'abc'}
def bang_frame(ms, hold=500):
    """혼비백산 "!" 말풍선 원래 그림 그대로"""
    d = list(BANG_A['durationsMs']); d[8] = hold
    for i, x in enumerate(d):
        if ms < x: return BANG[i]
        ms -= x
    return None

def load_item(path):
    """물건 그림(아무 크기) → 빈 테두리 잘라 냄. 32×32 넘으면 거절(머리 위에 올리기엔 너무 큼)"""
    a = np.array(Image.open(path).convert('RGBA'))
    ys, xs = np.nonzero(a[..., 3] > 0)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    assert a.shape[0] <= 32 and a.shape[1] <= 32, f'물건 그림이 32×32 보다 큼: {a.shape[1]}×{a.shape[0]}'
    return a

# ═══════════════════ 3) 캐릭터 ═══════════════════
class Character:
    """characters.json 한 항목 → 동작 그림 + 치수에서 나오는 값들"""
    def __init__(self, key, prof):
        self.key, self.p = key, prof
        self.idle_a, self.idle, self.idle_sh = load_anim(prof['anims']['idle'])
        if prof['anims'].get('walk'):
            _, self.walk, self.walk_sh = load_anim(prof['anims']['walk']); self.walk_hop = False
        else:                                   # 걷기 동작이 없으면 가만히 그림 + 통통 뛰기
            self.walk, self.walk_sh, self.walk_hop = None, None, True
        self.startle = load_anim(prof['anims']['startle']) if prof['anims'].get('startle') else None
        self.cheer = load_anim(prof['anims']['cheer']) if prof['anims'].get('cheer') else None
        self.feet, self.eye, self.top = prof['feetRow'], prof['eyeRow'], prof['headTopRow']
        self.wade = self.feet - (self.eye + 5)  # 잎에 잠길 때 발에서 몇 칸 위까지 잠기나 (눈·볼은 보임)
        self.dip = 7                            # 뒤적일 때 더 잠기는 칸 (눈까지 잠김)
        self.face_rows = (self.eye - 1, self.eye + 6)
        self.lean_cut = self.eye + 6
        self.crouch_row = prof['crouchRow']
        self.face_x = prof['faceX']
        self.body = {tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) for h in prof['bodyColors']}
        self.body_fill = hexc(prof['bodyColors'][0])

    def idle_at(self, ms):
        d = self.idle_a['durationsMs']; t = ms % sum(d)
        for i, x in enumerate(d):
            if t < x: return i
            t -= x
        return 0

    @staticmethod
    def once(anim, ms):
        """한 번 재생 동작의 (그림, 그림자, 뜬 높이) — 끝나면 마지막 장"""
        a, fr, sh = anim
        for i, d in enumerate(a['durationsMs']):
            if ms < d: return fr[i], sh[i], a['liftPx'][i]
            ms -= d
        return fr[-1], sh[-1], a['liftPx'][-1]

    def walk_frame(self, n, ms):
        if self.walk_hop:
            i = self.idle_at(ms); return self.idle[i], self.idle_sh[i], (-1 if n % 4 in (1, 2) else 0)
        i = n % len(self.walk); return self.walk[i], self.walk_sh[i], 0

    def lean(self, spr, dx):
        if dx == 0: return spr
        c = self.lean_cut
        out = spr.copy(); out[:c] = 0; top = spr[:c]
        if dx > 0: out[:c, dx:] = top[:, :-dx]
        else: out[:c, :dx] = top[:, -dx:]
        return out

    def look_face(self, spr, d):
        if d == 0: return spr
        y0, y1 = self.face_rows; x0, x1 = self.face_x
        out = spr.copy(); feat = np.zeros(spr.shape[:2], bool)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1):
                q = spr[y, x]
                if q[3] and tuple(q[:3]) not in self.body: feat[y, x] = True
        out[feat] = self.body_fill
        for y, x in zip(*np.nonzero(feat)):
            nx = x + d
            if spr[y, nx, 3] and tuple(spr[y, nx, :3]) != (0, 0, 0): out[y, nx] = spr[y, x]
        return out

    def look(self, spr, lv):
        """lv: -2 왼쪽 끝까지 · -1 · 0 정면 · 1 · 2 (끝까지면 윗몸도 1칸)"""
        if lv == 0: return spr
        d = 1 if abs(lv) == 1 else 2
        out = self.look_face(spr, d if lv > 0 else -d)
        if abs(lv) == 2: out = self.lean(out, 1 if lv > 0 else -1)
        return out

    def crouch(self, spr, k):
        if k <= 0: return spr
        c = self.crouch_row
        out = np.zeros_like(spr); out[c + k:] = spr[c + k:]; out[k:c + k] = spr[0:c]
        return out

def look_seq(r, seq):
    lv = 0
    for t0, target in seq:
        if r < t0: break
        prev = lv; k = min(abs(target - prev), int((r - t0) // 70) + 1)
        lv = prev + (k if target > prev else -k)
    return lv

# ═══════════════════ 2) 탐험 순서 재생 ═══════════════════
class Explore:
    def __init__(self, route, ch):
        self.R, self.ch = route, ch
        sc = route['scene']
        self.forest = Forest(os.path.join(PKG, route['forest']))
        self.FW, self.FH = self.forest.W, self.forest.H
        self.OX, self.OY = MARGIN_X, MARGIN_TOP
        self.CW, self.CH = self.FW + 2 * MARGIN_X, MARGIN_TOP + self.FH + MARGIN_BOTTOM
        self.L = route['loopMs']
        self.under_y = sc['underY']; self.out_ground = sc['outsideFrom']
        self.leaves = Leaves(route['fx']['leaves'])
        self.segs = route['character']
        self.item = None
        self.start = None                              # 찾기 장면 첫 travel 의 출발점(넘겨주기 자리)

    def state(self, ms):
        ch = self.ch
        for s in self.segs:
            k, t0 = s['kind'], s['t']
            if k == 'walk':
                path, step = s['path'], s['stepMs']
                if not (t0 <= ms < t0 + len(path) * step): continue
                n = int((ms - t0) // step); x, F = path[n]
                nx = path[min(n + 1, len(path) - 1)][0]
                dirx = 0 if abs(nx - x) < 0.3 else (1 if nx > x else -1)
                lv = dirx
                if dirx and (n // 16) % 4 == 3: lv = -2 * dirx            # 가끔 반대쪽 힐끗
                spr, sh, hop = ch.walk_frame(n, ms)
                F, x = int(round(F)), int(round(x))
                inside = 8 <= x < self.FW - 8 and F < self.out_ground and self.forest.opaque_at(x, F - 12)
                return dict(spr=ch.look(spr, lv), sh=None if F < self.out_ground else sh, x=x, feet=F + hop, sort=F, ground=F,
                            follow=(x, F - 12) if inside else None, bob=-1 if (inside and n % 4 < 2) else 0)
            if k == 'stand' and t0 <= ms < t0 + s['durMs']:
                r = ms - t0; i = ch.idle_at(r)
                q = (r - s['bubbleAt']) if (s.get('bubbleAt') is not None and r >= s['bubbleAt']) else None
                F = s['F']
                return dict(spr=ch.look(ch.idle[i], look_seq(r, s['look'])), sh=None if F < self.out_ground else ch.idle_sh[i],
                            x=s['x'], feet=F, sort=F, ground=F, q=q)
            if k == 'dig' and t0 <= ms < t0 + s['durMs']:
                r = ms - t0; dur = s['durMs']; D = ch.dip
                if r < 150: lift = round(D * ease_out(r / 150))
                elif r < dur - 150: lift = D + (1 if ((r - 150) // 200) % 3 == 1 else 0)
                else: lift = round(D * (1 - ease_out((r - dur + 150) / 150)))
                dx = 0 if r < 150 or r >= dur - 150 else (1 if ((r - 150) // 100) % 2 == 0 else -1)
                return dict(spr=ch.idle[0], sh=None, x=s['x'] + dx, feet=s['F'] + lift, sort=s['F'])
            if k == 'dive' and t0 <= ms < t0 + s['durMs']:
                r = ms - t0; (x0, F0), (x1, F1), dur = s['from'], s['to'], s['durMs']
                if r < 160: x, F, lift = x0, F0, (round(20 * ease_in(r / 160)) if s['sink'] else 20)
                elif r < dur - 160:
                    u = (r - 160) / (dur - 320); x, F, lift = lerp(x0, x1, u), lerp(F0, F1, u), 20
                else: x, F, lift = x1, F1, (round(20 * (1 - (r - dur + 160) / 160)) if s['rise'] else 20)
                x, F = int(round(x)), int(round(F))
                return dict(spr=ch.idle[0], sh=None, x=x, feet=F + lift, sort=F,
                            follow=(x, F - 12) if 160 <= r < dur - 160 else None)
            if k == 'under' and t0 <= ms < t0 + s['durMs']:
                r = ms - t0; step = s['stepMs']; F0, F1 = s['F0'], s['F1']
                n = int(r // step); F = F0 + (n if F1 > F0 else -n)
                spr, sh, hop = ch.walk_frame(n, ms)
                return dict(spr=spr, sh=sh if F >= self.out_ground + 4 else None, x=s['x'], feet=F + hop, sort=999, ground=F, under=True)
            if k == 'shake' and t0 <= ms < t0 + s['durMs']:
                # 750ms 마다 쿵: 0~150 물러서며 웅크림 · 150~240 박치기(3칸) · 240~360 튕김 · 마지막엔 섬
                r = ms - t0 - 300; dx, spr = 0, ch.look(ch.idle[0], -1)
                if 0 <= r < 2250:
                    q = r % 750
                    if q < 150: dx, spr = 1, ch.crouch(ch.look(ch.idle[0], -2), 1)
                    elif q < 240: dx, spr = -3, ch.look(ch.idle[0], -2)
                    elif q < 360: dx, spr = -1, ch.look(ch.idle[0], -1)
                elif r >= 2250: spr = ch.look(ch.idle[ch.idle_at(r)], -1)
                return dict(spr=spr, sh=ch.idle_sh[0], x=s['x'] + dx, feet=s['F'], sort=999, ground=s['F'])
            if k == 'travel' and t0 <= ms < t0 + s['durMs']:
                (x0, F0) = s['from'] or self.start; (x1, F1) = s['to']
                u = (ms - t0) / s['durMs']; x, F = int(round(lerp(x0, x1, u))), int(round(lerp(F0, F1, u)))
                return dict(spr=ch.idle[0], sh=None, x=x, feet=F + 20, sort=F, follow=(x, F - 12))
            if k == 'hidden' and t0 <= ms < t0 + s['durMs']:
                return dict(spr=ch.idle[0], sh=None, x=s['x'], feet=s['F'] + 20, sort=s['F'])
            if k == 'popup' and t0 <= ms < t0 + s['durMs']:
                # 0~140 쏙 올라옴(잠김 20칸 → 0) · 깜짝 동작(눈 동그래짐·움찔 뜀) · 끝나면 서서 좌우 두리번
                r = ms - t0
                up = round(20 * (1 - ease_out(min(1, r / 140))))
                if ch.startle and r >= 100:
                    spr, _, lift = ch.once(ch.startle, r - 100)
                else: spr, lift = ch.idle[0], 0
                if r >= 560: spr = ch.look(ch.idle[ch.idle_at(r)], (-1, 1)[(r // 120) % 2])
                return dict(spr=spr, sh=None, x=s['x'], feet=s['F'] + up + lift, sort=s['F'])
            if k == 'jump' and t0 <= ms < t0 + s['durMs']:
                (x0, F0), (x1, F1) = s['from'], s['to']; u = (ms - t0) / s['durMs']
                y = lerp(F0, F1, u) - s['height'] * 4 * u * (1 - u)
                x = int(round(lerp(x0, x1, u)))
                if s.get('into'):                                   # 숲으로 뛰어듦: 공중에선 앞쪽(다 보임) → 내려앉으며 잎에 잠김
                    sort = 999 if u < 0.7 else F1
                    return dict(spr=ch.idle[0], sh=ch.idle_sh[0] if u < 0.3 else None, x=x, feet=int(round(y)), sort=sort, ground=F0)
                sort = F0 if u < 0.3 else 999                       # 처음엔 잎을 헤치고 솟음 → 발이 잎 위로 나오면 화면 앞쪽으로
                return dict(spr=ch.idle[0], sh=ch.idle_sh[0] if u > 0.7 else None, x=x, feet=int(round(y)), sort=sort, ground=F1)
            if k == 'hop' and t0 <= ms < t0 + s['durMs']:
                u = (ms - t0) / s['durMs']; lift = -round(s['height'] * 4 * u * (1 - u))
                return dict(spr=ch.idle[0], sh=ch.idle_sh[0], x=s['x'], feet=s['F'] + lift, sort=999, ground=s['F'])
            if k == 'ready' and t0 <= ms < t0 + s['durMs']:
                r = ms - t0; k2 = 1 if r < 80 else 2
                return dict(spr=ch.crouch(ch.look(ch.idle[0], 0), k2), sh=ch.idle_sh[0], x=s['x'], feet=s['F'], sort=999, ground=s['F'])
            if k == 'land' and t0 <= ms < t0 + s['durMs']:
                r = ms - t0; k2 = 2 if r < 80 else (1 if r < 140 else 0)
                return dict(spr=ch.crouch(ch.idle[0], k2), sh=ch.idle_sh[0], x=s['x'], feet=s['F'], sort=999, ground=s['F'])
            if k in ('reveal', 'hold') and t0 <= ms < t0 + s['durMs']:
                r = ms - t0; i = ch.idle_at(r)
                return dict(spr=ch.idle[i], sh=ch.idle_sh[i], x=s['x'], feet=s['F'], sort=999, ground=s['F'], item_lift=0)
            if k == 'cheer' and t0 <= ms < t0 + 1200:
                r = ms - t0
                if ch.cheer: spr, sh, lift = ch.once(ch.cheer, r)
                else: spr, sh, lift = ch.idle[0], ch.idle_sh[0], (-3 if (r // 200) % 3 == 1 else 0)
                return dict(spr=spr, sh=sh, x=s['x'], feet=s['F'] + lift, sort=999, ground=s['F'])
        s0 = self.segs[0]
        if s0['kind'] == 'travel':
            (x0, F0) = self.start; return dict(spr=ch.idle[0], sh=None, x=x0, feet=F0 + 20, sort=F0)
        x0, F0 = int(round(s0['path'][0][0])), int(round(s0['path'][0][1]))
        return dict(spr=ch.idle[0], sh=None, x=x0, feet=F0, sort=F0)

    def frame(self, ms):
        ch, fo_, OX, OY, CW, CH = self.ch, self.forest, self.OX, self.OY, self.CW, self.CH
        st = self.state(ms)
        if st.get('sort', 999) >= self.out_ground: st['sort'] = 999          # 숲 밖(앞쪽 땅)에선 잎에 잠기지 않음
        img = np.zeros((CH, CW, 4), np.uint8)
        f = fo_.at(ms, self.R['fx']['rustles'], self.R['fx']['shakes'], st.get('follow'))
        blit(img, f, OX, OY)
        left = st['x'] - 16; top = st['feet'] - ch.feet          # 32칸 그림 왼쪽 위 (숲 좌표)
        if st.get('sh') is not None:
            blit(img, st['sh'], OX + left, OY + st.get('ground', st['feet']) - ch.feet)
        gl = np.zeros_like(img); blit(gl, st['spr'], OX + left, OY + top)
        g = gl[..., 3] > 0
        fol = np.zeros((CH, CW), bool); fol[OY:OY + self.FH, OX:OX + self.FW] = fo_.foliage(f)
        cap = None
        # 숲 속: 발 높이에서 wade 칸 위 덤불 아치선 아래는 잎이 앞 (한 줄이 가려지면 그 아래도 다 가림)
        if st['sort'] < 999:
            xs = np.arange(CW); ai = (xs - OX) % len(fo_.ARC)
            line = OY + st['sort'] - ch.wade + fo_.ARC[ai] + st.get('bob', 0)
            below = np.arange(CH)[:, None] >= line[None, :]
            gone = g & np.maximum.accumulate(below & fol, axis=0)
            gl[gone] = 0
            cols = np.nonzero(gone.any(axis=0))[0]
            if len(cols):
                cap = []
                for x in range(max(cols.min() - 3, 0), min(cols.max() + 4, CW)):
                    for row in range(5):
                        y = line[x] + row
                        if 0 <= y < CH and fol[y, x]: cap.append((y, x, fo_.cap_color(row, ai[x])))
        # 덤불 밑: 덤불 아랫단 물결선 위는 덤불이 가림 + 진한 잎 테
        if st.get('under'):
            yb = OY + self.under_y + np.array([fo_.BUMP[x % len(fo_.BUMP)] for x in range(CW)])
            gu = (gl[..., 3] > 0) & (np.arange(CH)[:, None] <= yb[None, :])
            gl[gu] = 0
            eu = np.zeros_like(gu); eu[1:] = gu[:-1]; eu &= gl[..., 3] > 0
            gl[eu] = fo_.EDGE
        vis = gl[..., 3] > 0
        ll = np.zeros_like(img); self.leaves.draw(ll, ms, self.L, OX, OY)
        blit(img, ll, 0, 0, mask=~vis)
        blit(img, gl, 0, 0)
        if cap:
            for y, x, c in cap: img[y, x] = c
        if st.get('q') is not None:
            qi = q_frame(st['q'])
            if qi is not None: blit(img, QB[qi], OX + st['x'] - QB_PIV[0], OY + top + ch.top + 2 - QB_PIV[1])
        # 물건: 나타나는 시각부터 머리 꼭대기 위(바닥 가운데 기준) — 250ms 동안 머리 뒤에서 솟아오름(1칸 넘쳤다 자리)
        it = self.R.get('item')
        if self.item is not None and it and it.get('onHeadAtStart') and ms < it['hideMs']:
            ih, iw = self.item.shape[:2]
            down = round((ih + 2) * ease_in(ms / it['hideMs']))
            ix = OX + st['x'] - iw // 2; iy = OY + top + ch.top - 1 - ih + down
            il = np.zeros_like(img); blit(il, self.item, ix, iy); blit(il, gl, 0, 0)     # 고치 뒤로 쏙
            m = il[..., 3] > 0; img[m] = il[m]
            st['_item_c'] = (st['x'], top + ch.top - 1 - ih // 2)
        if self.item is not None and it and 'appearAt' in it and ms >= it['appearAt']:
            r = ms - it['appearAt']
            ih, iw = self.item.shape[:2]
            rise = ih + 1 - round((ih + 2) * ease_out(min(1, r / 250))) if r < 250 else (-1 if r < 320 else 0)
            bob = (-1 if (r // 400) % 2 else 0) if r > 700 else 0
            ix = OX + st['x'] - iw // 2; iy = OY + top + ch.top - 1 - ih + rise + bob
            if r < 250:                                    # 머리 뒤에서 솟는 동안은 고치 뒤에
                il = np.zeros_like(img); blit(il, self.item, ix, iy); blit(il, gl, 0, 0)
                m = il[..., 3] > 0; img[m] = il[m]
            else: blit(img, self.item, ix, iy)
            st['_item_c'] = (st['x'], top + ch.top - 1 - ih // 2)
        for fw in self.R['fx'].get('fireworks', []):
            fr = FIREWORK[fw['kind']].frame(ms - fw['t']) if ms >= fw['t'] else None
            if fr is not None:
                cx, cy = st.get('_item_c', (st['x'], top + ch.top - 8))
                blit(img, fr, OX + cx + fw['dx'] - 16, OY + cy + fw['dy'] - 16)
        for b in self.R['fx'].get('bubbles', []):
            if ms >= b['t']:
                fr = bang_frame(ms - b['t'], b.get('holdMs', 500))
                if fr is not None: blit(img, fr, OX + st['x'] - QB_PIV[0], OY + top + ch.top + 2 - QB_PIV[1])
        return img

    def render(self):
        return [self.frame(ms) for ms in range(0, self.L, TICK)]

def save_gif(frames, path, scale=2, bg=(255, 255, 255)):
    H, W = frames[0].shape[:2]
    ims = []
    for a in frames:
        b = Image.new('RGBA', (W, H), bg + (255,)); b.alpha_composite(Image.fromarray(a))
        ims.append(b.convert('RGB').resize((W * scale, H * scale), Image.NEAREST).quantize(255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=TICK, loop=0, disposal=1)

def zoom(ex, times, box, path, sc=4):
    from PIL import ImageDraw
    x0, y0, x1, y1 = box; ims = []
    for t in times:
        a = ex.frame(t); b = Image.new('RGBA', (ex.CW, ex.CH), (255, 255, 255, 255)); b.alpha_composite(Image.fromarray(a))
        c = b.crop(box).resize(((x1 - x0) * sc, (y1 - y0) * sc), Image.NEAREST)
        ImageDraw.Draw(c).text((3, 3), f'{t}', fill=(255, 0, 0)); ims.append(c)
    cols = min(len(ims), 4); rows = (len(ims) + cols - 1) // cols; W, H = ims[0].size
    out = Image.new('RGB', (W * cols + 4 * (cols - 1), H * rows + 4 * (rows - 1)), (60, 60, 60))
    for i, c in enumerate(ims): out.paste(c, ((i % cols) * (W + 4), (i // cols) * (H + 4)))
    out.save(path)

SCENES = os.path.join(DATA, 'scenes')
def load_scene(rel): return json.load(open(os.path.join(SCENES, rel), encoding='utf-8'))

def approach_route(intro, frm, step=45):
    """미리보기 전용(앱 몫 흉내): 섬에서 걸어오는 것 대신 frm 에서 도착 지점까지 걷기"""
    ex, eF = intro['entry']['x'], intro['entry']['F']; x0, F0 = frm
    n = max(abs(ex - x0), abs(eF - F0))
    path = [[x0 + (ex - x0) * k / n, F0 + (eF - F0) * k / n] for k in range(n)]
    r = dict(intro); r['character'] = [dict(kind='walk', t=0, path=path, stepMs=step)]
    r['fx'] = dict(rustles=[], shakes=[], leaves=[]); r['loopMs'] = n * step
    return r

def render_explore(ch, loops=1, approach_from=(-14, 124)):
    """평소 탐험: (미리보기용 걸어오기) → 시작(1회) → 반복 loops 바퀴"""
    intro, loop = load_scene('explore/intro.json'), load_scene('explore/loop.json')
    a, b = Explore(intro, ch), Explore(loop, ch)
    fr = []
    if approach_from:
        w = Explore(approach_route(intro, approach_from), ch)
        fr += [w.frame(ms) for ms in range(0, w.L, TICK)]
    fr += [a.frame(ms) for ms in range(0, a.L, TICK)]
    for _ in range(loops): fr += [b.frame(ms) for ms in range(0, b.L, TICK)]
    return fr

def render_find(ch, item, before_ms=5000, hold_loops=2):
    """물건 찾기: 반복 탐험 중 넘겨주기(두 번째) 전 before_ms 동안 → 찾기 장면 → 마지막 자세를 hold_loops 번 더"""
    loop, found = load_scene('explore/loop.json'), load_scene('find/find.json')
    ex = Explore(loop, ch); h = loop['handoffs'][1]
    frames = [ex.frame(ms) for ms in range(h['t'] - before_ms, h['t'], TICK)]
    fx = Explore(found, ch); fx.start = (h['x'], h['F']); fx.item = item
    L, H0 = found['loopMs'], found['holdFrom']
    frames += [fx.frame(ms) for ms in range(0, L, TICK)]
    for _ in range(hold_loops): frames += [fx.frame(ms) for ms in range(H0, L, TICK)]
    return frames

def render_leave(ch, item, walk_off=(-20, 124)):
    """떠나기 미리보기: 찾기 장면 마지막 자세 1번 → 떠나기 → (앱 몫 흉내) 섬 쪽으로 화면 밖까지 걸어감"""
    found, leave = load_scene('find/find.json'), load_scene('find/leave.json')
    fx = Explore(found, ch); fx.item = item; fx.start = (96, 84)
    fr = [fx.frame(ms) for ms in range(found['holdFrom'], found['loopMs'], TICK)]
    lv = Explore(leave, ch); lv.item = item
    fr += [lv.frame(ms) for ms in range(0, lv.L, TICK)]
    if walk_off:
        ex, eF = leave['exit']['x'], leave['exit']['F']; x1, F1 = walk_off
        n = max(abs(x1 - ex), abs(F1 - eF))
        r = dict(leave); r['character'] = [dict(kind='walk', t=0, path=[[ex + (x1 - ex) * k / n, eF + (F1 - eF) * k / n] for k in range(n)], stepMs=45)]
        r['fx'] = dict(rustles=[], shakes=[], leaves=[]); r['loopMs'] = n * 45; r.pop('item', None)
        w = Explore(r, ch); fr += [w.frame(ms) for ms in range(0, w.L, TICK)]
    return fr

if __name__ == '__main__':
    args = sys.argv[1:]
    which = args[args.index('--char') + 1] if '--char' in args else 'all'
    items = args[args.index('--items') + 1].split(',') if '--items' in args else ['placeholder.png', 'egg-sample.png']
    chars = json.load(open(os.path.join(DATA, 'characters.json'), encoding='utf-8'))['characters']
    os.makedirs(PREVIEW, exist_ok=True)
    for key in (chars if which == 'all' else [which]):
        ch = Character(key, chars[key])
        fr = render_explore(ch)
        save_gif(fr, os.path.join(PREVIEW, f'explore_{key}.gif'))
        print(key, '평소 탐험(시작+반복 1바퀴)', len(fr), '장')
        for item_p in items:
            ff = render_find(ch, load_item(os.path.join(DATA, 'items', item_p)))
            save_gif(ff, os.path.join(PREVIEW, f'find_{key}_{os.path.splitext(item_p)[0]}.gif'))
            print(' ', key, '물건 찾기', item_p, len(ff), '장')
        lf = render_leave(ch, load_item(os.path.join(DATA, 'items', items[0])))
        save_gif(lf, os.path.join(PREVIEW, f'leave_{key}.gif'))
        print(' ', key, '떠나기', len(lf), '장')
