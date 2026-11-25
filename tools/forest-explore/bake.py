"""프론트 전달용 굽기 — 캐릭터마다 '그림 모음(kit)' + 장면마다 40ms 재생표(track)를 만들어,
프론트는 계산 없이 재생표대로 그리기만 하면 되게 함 (그리기 규칙은 README · forestExplore.js).

  python -I -X utf8 tools/forest-explore/bake.py          (내보낼 곳 = assets/scenes/forest-explore/)

만드는 것 (<폴더>/characters/<캐릭터>/):
  kit.png      — 이 캐릭터가 숲 탐험에서 쓰는 32×32 그림(두리번·웅크림 등 바꾼 그림 포함)을 가로 16칸씩 모은 시트
  shadow.png   — 그림자 그림 모음 (같은 방식)
  intro.json · loop.json · find.json · leave.json — 장면별 재생표: frames[ms/40] = 그 순간 그릴 것
검증: 재생표만으로 다시 그린 그림(compose)이 엔진 그림(Explore.frame)과 모든 장에서 같아야 통과.
"""
import json, os, sys, hashlib
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import explore_engine as E

COLS = 16

class Kit:
    def __init__(self): self.idx, self.frames = {}, []
    def add(self, spr):
        if spr is None: return -1
        k = hashlib.md5(spr.tobytes()).hexdigest()
        if k not in self.idx: self.idx[k] = len(self.frames); self.frames.append(spr)
        return self.idx[k]
    def sheet(self):
        n = max(1, len(self.frames)); rows = (n + COLS - 1) // COLS
        out = np.zeros((rows * 32, COLS * 32, 4), np.uint8)
        for i, f in enumerate(self.frames): out[(i // COLS) * 32:(i // COLS) * 32 + 32, (i % COLS) * 32:(i % COLS) * 32 + 32] = f
        return out

def bake_tick(ex, ms, kit, shk):
    """Explore.frame 과 같은 순서로 '무엇을 어디에' 만 기록 (숲 좌표 · 정수)"""
    ch, fo_ = ex.ch, ex.forest
    st = ex.state(ms)
    if st.get('sort', 999) >= ex.out_ground: st['sort'] = 999
    rec = {}
    # 숲 흔들기 목록 (적용 순서대로): [cx, cy, rx, ry, dx, dy, 방식] 방식 0 = 타원 안 전부 · 1 = 타원 안 잎만(+새로 생긴 칸)
    sf = []
    items = [(r['t0'], r['cx'], r['cy'], r['rx'], r['ry']) for r in ex.R['fx']['rustles'] if r['t0'] <= ms < r['t1']]
    if st.get('follow'): items.append((0, st['follow'][0], st['follow'][1], 11, 7))
    for (t0, cx, cy, rx, ry) in items:
        dx, dy = fo_.RUSTLE_CYCLE[int((ms - t0) // 70) % 4]
        if (dx, dy) != (0, 0): sf.append([cx, cy, rx, ry, dx, dy, 0])
    for sk in ex.R['fx']['shakes']:
        k = int((ms - sk['t']) // 60)
        if 0 <= k < len(sk['seq']) and tuple(sk['seq'][k]) != (0, 0):
            sf.append([sk['cx'], sk['cy'], sk['rx'], sk['ry'], sk['seq'][k][0], sk['seq'][k][1], 1])
    if sf: rec['sf'] = sf
    left = st['x'] - 16; top = st['feet'] - ch.feet
    rec['c'] = kit.add(st['spr']); rec['x'] = int(left); rec['y'] = int(top)
    if st.get('sh') is not None:
        rec['s'] = shk.add(st['sh']); rec['sy'] = int(st.get('ground', st['feet']) - ch.feet)
    if st['sort'] < 999: rec['w'] = int(st['sort'] - ch.wade + st.get('bob', 0))   # 잎 아치선 기준 y (+ ARC[x%16])
    if st.get('under'): rec['u'] = 1
    # 잎 [x, y, 모양]
    lv = []
    for t0, pts, kind in ex.leaves.list:
        for base in (t0, t0 - ex.L):
            i = int((ms - base) // 20)
            if 0 <= i < len(pts):
                x, y = pts[i]
                lv.append([int(round(x)), int(round(y)), (i // 5) % 3 if kind == 2 else (i // 6) % 2])
    if lv: rec['l'] = lv
    head_y = int(top + ch.top)                                  # 머리 꼭대기 줄 y (말풍선·물건 기준)
    rec['hx'] = int(st['x']); rec['hy'] = head_y
    if st.get('q') is not None:
        qi = E.q_frame(st['q'])
        if qi is not None: rec['q'] = qi                        # "?" 말풍선 장 (question.png)
    it = ex.R.get('item')
    if it and it.get('onHeadAtStart') and ms < it['hideMs']: rec['ih'] = int(ms)                    # 물건 내려가며 사라짐 경과 ms
    if it and 'appearAt' in it and ms >= it['appearAt']: rec['ia'] = int(ms - it['appearAt'])        # 물건 나타난 뒤 경과 ms
    fw = []
    for f in ex.R['fx'].get('fireworks', []):
        if ms >= f['t']:
            fi = E.FIREWORK[f['kind']]; r = ms - f['t']; idx = None
            for j, d in enumerate(fi.a['durationsMs']):
                if r < d: idx = j; break
                r -= d
            if idx is not None: fw.append([f['kind'], idx, f['dx'], f['dy']])
    if fw: rec['f'] = fw
    for b in ex.R['fx'].get('bubbles', []):
        if ms >= b['t']:
            d = list(E.BANG_A['durationsMs']); d[8] = b.get('holdMs', 500); r = ms - b['t']
            for j, x in enumerate(d):
                if r < x: rec['b'] = j; break
                r -= x
    return rec

# ── 재생표만으로 다시 그리기 (forestExplore.js 와 같은 규칙 — 검증용)
FOREST = None
def compose(rec, ex, kit_frames, sh_frames, item=None):
    fo_ = ex.forest; OX, OY, CW, CH = ex.OX, ex.OY, ex.CW, ex.CH
    f = fo_.img.copy()
    for cx, cy, rx, ry, dx, dy, mode in rec.get('sf', []):
        src = fo_._shift(f, dx, dy)
        e = ((fo_.xx - cx) / rx) ** 2 + ((fo_.yy - cy) / ry) ** 2 <= 1
        m = e if mode == 0 else ((e & fo_.foliage(f)) | (e & (src[..., 3] > 0) & ~(f[..., 3] > 0)))
        f[m] = src[m]
    img = np.zeros((CH, CW, 4), np.uint8); E.blit(img, f, OX, OY)
    if 's' in rec: E.blit(img, sh_frames[rec['s']], OX + rec['x'], OY + rec['sy'])
    gl = np.zeros_like(img); E.blit(gl, kit_frames[rec['c']], OX + rec['x'], OY + rec['y'])
    g = gl[..., 3] > 0
    fol = np.zeros((CH, CW), bool); fol[OY:OY + ex.FH, OX:OX + ex.FW] = fo_.foliage(f)
    cap = None
    if 'w' in rec:
        xs = np.arange(CW); ai = (xs - OX) % 16
        line = OY + rec['w'] + fo_.ARC[ai]
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
    if rec.get('u'):
        yb = OY + ex.under_y + np.array([fo_.BUMP[x % 10] for x in range(CW)])
        gu = (gl[..., 3] > 0) & (np.arange(CH)[:, None] <= yb[None, :])
        gl[gu] = 0
        eu = np.zeros_like(gu); eu[1:] = gu[:-1]; eu &= gl[..., 3] > 0
        gl[eu] = fo_.EDGE
    vis = gl[..., 3] > 0
    ll = np.zeros_like(img)
    for x, y, k in rec.get('l', []): E.blit(ll, E.LEAF[k], OX + x, OY + y)
    E.blit(img, ll, 0, 0, mask=~vis)
    E.blit(img, gl, 0, 0)
    if cap:
        for y, x, c in cap: img[y, x] = c
    hx, hy = rec['hx'], rec['hy']
    if 'q' in rec: E.blit(img, E.QB[rec['q']], OX + hx - 8, OY + hy + 2 - 16)
    ic = None
    if item is not None and 'ih' in rec:
        ih_, iw = item.shape[:2]
        down = round((ih_ + 2) * E.ease_in(rec['ih'] / ex.R['item']['hideMs']))
        il = np.zeros_like(img); E.blit(il, item, OX + hx - iw // 2, OY + hy - 1 - ih_ + down); E.blit(il, gl, 0, 0)
        m = il[..., 3] > 0; img[m] = il[m]; ic = (hx, hy - 1 - ih_ // 2)
    if item is not None and 'ia' in rec:
        r = rec['ia']; ih_, iw = item.shape[:2]
        rise = ih_ + 1 - round((ih_ + 2) * E.ease_out(min(1, r / 250))) if r < 250 else (-1 if r < 320 else 0)
        bob = (-1 if (r // 400) % 2 else 0) if r > 700 else 0
        ix, iy = OX + hx - iw // 2, OY + hy - 1 - ih_ + rise + bob
        if r < 250:
            il = np.zeros_like(img); E.blit(il, item, ix, iy); E.blit(il, gl, 0, 0)
            m = il[..., 3] > 0; img[m] = il[m]
        else: E.blit(img, item, ix, iy)
        ic = (hx, hy - 1 - ih_ // 2)
    for kind, idx, dx, dy in rec.get('f', []):
        cx, cy = ic if ic else (hx, hy - 8)
        E.blit(img, E.FIREWORK[kind].fr[idx], OX + cx + dx - 16, OY + cy + dy - 16)
    if 'b' in rec: E.blit(img, E.BANG[rec['b']], OX + hx - 8, OY + hy + 2 - 16)
    return img

SCENE_FILES = [('intro', 'explore/intro.json'), ('loop', 'explore/loop.json'), ('find', 'find/find.json'), ('leave', 'find/leave.json')]

def bake_all(out_dir, verify_item='placeholder.png', verify_every=1):
    chars = json.load(open(os.path.join(E.DATA, 'characters.json'), encoding='utf-8'))['characters']
    item = E.load_item(os.path.join(E.DATA, 'items', verify_item))
    report = {}
    for key, prof in chars.items():
        ch = E.Character(key, prof); kit, shk = Kit(), Kit()
        tracks = {}
        for name, rel in SCENE_FILES:
            R = E.load_scene(rel); ex = E.Explore(R, ch)
            if name == 'find': ex.start = tuple(E.load_scene('explore/loop.json')['handoffs'][1][k] for k in ('x', 'F'))
            if name in ('find', 'leave'): ex.item = item
            recs = [bake_tick(ex, ms, kit, shk) for ms in range(0, ex.L, E.TICK)]
            tracks[name] = (R, ex, recs)
        # 검증
        bad = 0; total = 0
        for name, (R, ex, recs) in tracks.items():
            for i in range(0, len(recs), verify_every):
                a = ex.frame(i * E.TICK); b = compose(recs[i], ex, kit.frames, shk.frames, ex.item)
                total += 1
                if not np.array_equal(a, b): bad += 1
        report[key] = dict(kit=len(kit.frames), shadow=len(shk.frames), checked=total, mismatched=bad)
        print(key, report[key])
        cdir = os.path.join(out_dir, 'characters', key); os.makedirs(cdir, exist_ok=True)
        Image.fromarray(kit.sheet()).save(os.path.join(cdir, 'kit.png'))
        Image.fromarray(shk.sheet()).save(os.path.join(cdir, 'shadow.png'))
        for name, (R, ex, recs) in tracks.items():
            meta = dict(format='gachi-forest-explore-track/1', scene=name, character=key, tickMs=E.TICK, frames=len(recs),
                        durationMs=len(recs) * E.TICK, kit='kit.png', shadow='shadow.png', kitCols=COLS, cell=32,
                        canvas=dict(w=ex.CW, h=ex.CH, forestX=ex.OX, forestY=ex.OY), forest='../../forest.png', underY=ex.under_y)
            for k in ('holdFrom', 'handoffs', 'entry', 'exit', 'item', 'next', 'prev'):
                if k in R: meta[k] = R[k]
            if name == 'find': meta['holdFromFrame'] = R['holdFrom'] // E.TICK
            out = dict(**meta, track=recs)
            if name == 'find':
                # 첫 travel(잠긴 채 넘겨주기 자리 → 찾는 자리, 0.7초)은 넘겨주기 자리마다 머리 위 들썩 위치가 다름 →
                # 넘겨주기 k 에서 시작하면 처음 travelFrames 장은 travelByHandoff[k] 를 쓰고, 그다음부터 track 을 씀
                tr = R['character'][0]; nT = -(-tr['durMs'] // E.TICK)        # travel 이 걸친 장 수(올림)
                out['travelFrames'] = nT
                out['travelByHandoff'] = []
                for h in E.load_scene('explore/loop.json')['handoffs']:
                    ex2 = E.Explore(R, ex.ch); ex2.start = (h['x'], h['F']); ex2.item = ex.item
                    out['travelByHandoff'].append([bake_tick(ex2, ms, kit, shk) for ms in range(0, nT * E.TICK, E.TICK)])
            json.dump(out, open(os.path.join(cdir, f'{name}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        Image.fromarray(kit.sheet()).save(os.path.join(cdir, 'kit.png'))
        Image.fromarray(shk.sheet()).save(os.path.join(cdir, 'shadow.png'))
        report[key]['kit'] = len(kit.frames)
    return report

if __name__ == '__main__':
    bake_all(E.PKG)
