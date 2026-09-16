#!/usr/bin/env python3
# ══════════════════════════════════════════════════════════════
#  Pixel Survi — generador de assets
#  Recorta los modelos originales (models/assert/**, models/junior)
#  y arma los PNG que consume el juego:
#     tiles.png  junior.png  tools-held.png  tools-icon.png
#     cracks.png  portada.png
#  Imprime el orden de tiles listo para pegar en survi_config.js.
# ══════════════════════════════════════════════════════════════
import os, json, math, random
from PIL import Image, ImageDraw

SRC = 'models/assert'
OUT = 'out/assets'
os.makedirs(OUT, exist_ok=True)
CELL = 16

def load(p):
    return Image.open(p).convert('RGBA')

# ─── recorte genérico de una celda de una grilla ───
def cut(im, x0, y0, x1, y1, full=None):
    """Recorta la celda [x0,x1)x[y0,y1) y la lleva a 16x16.
    Si el contenido ocupa casi toda la celda se estira a 16x16 (pieza de
    tile completo). Si es una pieza chica (rama, mata) se escala con el
    factor de la celda y se pega centrada donde estaba."""
    cw, ch = x1 - x0, y1 - y0
    cellim = im.crop((int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))))
    bb = cellim.getbbox()
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    if bb is None:
        return out
    bw, bh = bb[2] - bb[0], bb[3] - bb[1]
    fills = (bw / cw > 0.82 and bh / ch > 0.82) if full is None else full
    piece = cellim.crop(bb)
    if fills:
        return piece.resize((CELL, CELL), Image.BOX)
    k = CELL / cw
    nw = max(1, int(round(bw * k)))
    nh = max(1, int(round(bh * k)))
    out.alpha_composite(piece.resize((nw, nh), Image.BOX),
                        (min(CELL - nw, max(0, int(round(bb[0] * k)))),
                         min(CELL - nh, max(0, int(round(bb[1] * k))))))
    return out

def grid_cutter(path, cols, rows, x0=0, y0=0, x1=None, y1=None):
    im = load(path)
    x1 = im.width if x1 is None else x1
    y1 = im.height if y1 is None else y1
    cw, ch = (x1 - x0) / cols, (y1 - y0) / rows
    def g(r, c, full=None):
        return cut(im, x0 + c * cw, y0 + r * ch, x0 + (c + 1) * cw, y0 + (r + 1) * ch, full)
    return g

def band_cutter(path, xs, ys):
    """Igual que grid_cutter pero con los limites exactos de cada fila y
    columna. Las hojas de arboles no tienen una grilla uniforme: entre
    algunas piezas hay margen transparente y entre otras no."""
    im = load(path)
    def g(r, c, full=None):
        (a, b), (u, v) = xs[c], ys[r]
        return cut(im, a, u, b, v, full)
    return g

# ══════════ 1. Familias de terreno (autotile de 10 piezas) ══════════
# Las hojas de assert/world traen un bloque 3x3 tipo "blob": el borde de
# arriba es el pasto/costra y el centro es el relleno. Con esas 9 piezas
# + el bloque suelto alcanza para las 16 combinaciones de vecinos
# (ver MASK_TO_PIECE en survi_config.js).
PIECES = ['C', 'T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR', 'S']

def make_single(m):
    """El bloque suelto (sin vecinos) no esta en todas las hojas y donde
    esta no siempre cae en la grilla. Se arma con los cuatro cuadrantes de
    las esquinas del blob: queda con borde en los cuatro lados."""
    h = CELL // 2
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    for key, (x, y) in (('TL', (0, 0)), ('TR', (h, 0)), ('BL', (0, h)), ('BR', (h, h))):
        out.alpha_composite(m[key].crop((x, y, x + h, y + h)), (x, y))
    return out

def family(path, cols, rows, single_rc, blob=(0, 0)):
    g = grid_cutter(path, cols, rows)
    br, bc = blob
    m = {
        'TL': g(br + 0, bc + 0, True), 'T': g(br + 0, bc + 1, True), 'TR': g(br + 0, bc + 2, True),
        'L':  g(br + 1, bc + 0, True), 'C': g(br + 1, bc + 1, True), 'R':  g(br + 1, bc + 2, True),
        'BL': g(br + 2, bc + 0, True), 'B': g(br + 2, bc + 1, True), 'BR': g(br + 2, bc + 2, True),
    }
    m['S'] = make_single(m)
    return m

def family_bbox(path, blob_box, single_box):
    """Para pradera/desert, donde el bloque suelto no cae en la grilla."""
    im = load(path)
    x0, y0, x1, y1 = blob_box
    cw, ch = (x1 - x0) / 3, (y1 - y0) / 3
    names = [['TL', 'T', 'TR'], ['L', 'C', 'R'], ['BL', 'B', 'BR']]
    m = {}
    for r in range(3):
        for c in range(3):
            m[names[r][c]] = cut(im, x0 + c * cw, y0 + r * ch, x0 + (c + 1) * cw, y0 + (r + 1) * ch, True)
    m['S'] = make_single(m)
    return m

FAMS = {}
FAMS['grass'] = family_bbox(f'{SRC}/world/pradera.png', (0, 0, 512, 512), (220, 598, 393, 771))
FAMS['sand']  = family_bbox(f'{SRC}/world/desert.png',  (0, 0, 1024, 1024), (441, 1199, 784, 1539))
FAMS['snow']  = family(f'{SRC}/world/snow.png', 6, 6, (3, 4))
FAMS['jgrass'] = family(f'{SRC}/world/Forestblack.png', 6, 6, (4, 1))
FAMS['cave']  = family(f'{SRC}/world/cavegrass.png', 10, 6, (1, 4))

# Forestblack y blacktree son casi negros: al lado del resto de los biomas
# la selva quedaba como un agujero. Se les levanta el brillo.
def brighten(m, mul=1.30, add=16):
    return {k: tint(v, (mul, mul, mul), (add, add, add)) for k, v in m.items()}

# ══════════ 2. Tiles simples (relleno, piedra, vetas, hielo…) ══════════
def tint(im, mul, add=(0, 0, 0), sat=1.0):
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            r = lum + (r - lum) * sat
            g = lum + (g - lum) * sat
            b = lum + (b - lum) * sat
            px[x, y] = (min(255, max(0, int(r * mul[0] + add[0]))),
                        min(255, max(0, int(g * mul[1] + add[1]))),
                        min(255, max(0, int(b * mul[2] + add[2]))), a)
    return out

DIRT  = FAMS['grass']['C'].copy()
STONE = tint(FAMS['cave']['C'], (1.05, 1.08, 1.15), (34, 34, 40), sat=0.25)
ICE   = tint(FAMS['snow']['C'], (0.9, 1.05, 1.25), (10, 22, 40), sat=1.3)
BEDROCK = tint(FAMS['cave']['C'], (0.45, 0.45, 0.5), (6, 6, 10), sat=0.4)

# Vetas: manchas sobre la roca de cueva. No hay textura de mineral en los
# modelos, así que se dibujan encima con la paleta de cada uno.
def ore(base, cols, seed):
    im = base.copy()
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for (cx, cy) in [(4, 3), (10, 5), (6, 10), (12, 11)]:
        cx += rnd.randint(-1, 1); cy += rnd.randint(-1, 1)
        d.rectangle([cx, cy, cx + 1, cy + 1], fill=cols[0])
        d.point((cx, cy), fill=cols[1])
        d.point((cx + 1, cy + 1), fill=cols[2])
        if rnd.random() < 0.6:
            d.point((cx + 2, cy), fill=cols[0])
    return im

COAL = ore(FAMS['cave']['C'], [(28, 28, 34, 255), (74, 74, 86, 255), (12, 12, 16, 255)], 1)
IRON = ore(FAMS['cave']['C'], [(176, 142, 116, 255), (224, 198, 172, 255), (110, 84, 64, 255)], 2)
GOLD = ore(FAMS['cave']['C'], [(226, 182, 54, 255), (255, 232, 140, 255), (150, 110, 26, 255)], 3)

# Cactus: tampoco hay modelo, se dibuja (cuerpo, sombra y espinas).
def cactus_tile():
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([3, 0, 12, 15], fill=(62, 124, 66, 255))
    d.rectangle([3, 0, 5, 15], fill=(84, 156, 84, 255))
    d.rectangle([11, 0, 12, 15], fill=(38, 88, 48, 255))
    d.rectangle([2, 0, 2, 15], fill=(28, 62, 36, 255))
    d.rectangle([13, 0, 13, 15], fill=(28, 62, 36, 255))
    for y in range(1, 15, 4):
        d.point((4, y), fill=(196, 214, 150, 255))
        d.point((10, y + 2), fill=(196, 214, 150, 255))
    return im

SIMPLE = {
    'dirt': DIRT, 'stone': STONE, 'ice': ICE, 'bedrock': BEDROCK,
    'coal': COAL, 'iron': IRON, 'gold': GOLD, 'cactus': cactus_tile()
}

# ══════════ 3. Árboles: 3 paletas x 27 piezas ══════════
# Las tres hojas (treee / pradera-tree / blacktree) comparten el mismo
# layout de 4 columnas x 7 filas: arriba el "blob" de hojas y abajo los
# troncos y ramas.
TREE_PIECES = [
    # hojas (blob 3 col x 4 filas → dos variantes de fila media)
    'LTL', 'LT', 'LTR',
    'LL', 'LC', 'LR',
    'LL2', 'LC2', 'LR2',
    'LBL', 'LB', 'LBR',
    'LVT', 'LVM', 'LVB',          # columna angosta de hojas
    'LBLOB', 'LCAN',              # mata suelta / copa con el tronco entrando
    'LARM_L', 'LARM_R',           # rama con follaje
    # madera
    'TRUNK', 'TRUNK_K', 'TRUNK_BR', 'TRUNK_BASE', 'TRUNK_R',
    'STUB', 'BRANCH_H', 'BRANCH_S'
]

def bands(pairs):
    return [(float(a), float(b)) for a, b in pairs]

def split(a, b, n):
    """Parte un tramo continuo (piezas pegadas, sin margen) en n celdas."""
    w = (b - a) / n
    return [(a + i * w, a + (i + 1) * w) for i in range(n)]

TREE_SRC = {
    # (ruta, columnas, filas) — limites medidos sobre cada PNG
    'forest': (f'{SRC}/world/treee.png',
               bands([(1, 35)]) + split(38, 143, 3),
               bands([(4, 35)]) + split(38, 206, 5) + bands([(209, 241)])),
    'pradera': (f'{SRC}/world/pradera-tree.png',
                bands([(18, 350), (377, 709), (743, 1057), (1093, 1416)]),
                bands([(45, 347), (383, 685), (722, 1033), (1059, 1371),
                       (1398, 1709), (1738, 2048), (2078, 2384)])),
    'jungle': (f'{SRC}/world/blacktree.png',
               bands([(18, 354), (386, 711), (741, 1082), (1093, 1446)]),
               bands([(46, 353), (385, 690), (714, 1031), (1055, 1377),
                      (1398, 1718), (1740, 2050), (2072, 2383)]))
}

def tree_family(path, xs, ys):
    g = band_cutter(path, xs, ys)
    return {
        'LVT': g(0, 0, True), 'LTL': g(0, 1, True), 'LT': g(0, 2, True), 'LTR': g(0, 3, True),
        'LVM': g(1, 0, True), 'LL':  g(1, 1, True), 'LC': g(1, 2, True), 'LR':  g(1, 3, True),
        'LVB': g(2, 0, True), 'LL2': g(2, 1, True), 'LC2': g(2, 2, True), 'LR2': g(2, 3, True),
        'LBL': g(3, 1, True), 'LB':  g(3, 2, True), 'LBR': g(3, 3, True),
        'LARM_L': g(4, 0), 'LCAN': g(4, 1, True), 'LBLOB': g(4, 2), 'LARM_R': g(4, 3),
        'TRUNK': g(5, 0, True), 'TRUNK_BR': g(5, 1, True), 'STUB': g(5, 2), 'BRANCH_H': g(5, 3),
        'TRUNK_K': g(6, 0, True), 'TRUNK_BASE': g(6, 1, True), 'TRUNK_R': g(6, 2, True),
        'BRANCH_S': g(6, 3)
    }

# Cada pieza del modelo viene con su contorno oscuro en los CUATRO lados.
# Pegadas forman una copa que se lee como una grilla de cuadrados en vez de
# una masa de hojas. Por cada pieza se borra el contorno de los lados que,
# segun el autotile, siempre tocan otra hoja (ver MASK_PIECE).
STRIP = {
    'LC': 'UDLR', 'LC2': 'UDLR',
    'LT': 'DLR', 'LB': 'ULR',
    'LL': 'UDR', 'LL2': 'UDR', 'LR': 'UDL', 'LR2': 'UDL',
    'LTL': 'DR', 'LTR': 'DL', 'LBL': 'UR', 'LBR': 'UL',
    'LVT': 'D', 'LVM': 'UD', 'LVB': 'U',
    'LCAN': 'ULR',
    'TRUNK': 'UD', 'TRUNK_K': 'UD', 'TRUNK_BR': 'UD', 'TRUNK_R': 'UD',
    'TRUNK_BASE': 'U'
}

def edge_width(im, side, cap=5):
    """Cuantas filas/columnas hay que borrar de ese borde.

    Cada pieza del modelo esta dibujada como un cuadrado con relieve: un
    contorno oscuro afuera y un bisel MAS CLARO adentro. Los dos hay que
    sacarlos, si no la copa se lee como una pila de cuadrados. Se compara
    contra el color del centro del tile y se descuenta todo lo que no
    coincida.
    """
    px = im.load(); n = CELL
    def lum(p):
        return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    def line(i):
        """Fila/columna i contando desde el borde, sin las esquinas."""
        out = []
        for j in range(4, n - 4):
            p = px[(j, i) if side == 'U' else
                   (j, n - 1 - i) if side == 'D' else
                   (i, j) if side == 'L' else (n - 1 - i, j)]
            if p[3] > 40: out.append(lum(p))
        return sum(out) / len(out) if out else None
    ref = []
    for y in range(5, n - 5):
        for x in range(5, n - 5):
            p = px[x, y]
            if p[3] > 40: ref.append(lum(p))
    if not ref: return 0
    ref = sum(ref) / len(ref)
    w = 0
    for i in range(cap):
        l = line(i)
        if l is None or abs(l - ref) > ref * 0.08: w = i + 1
        else: break
    return w

def strip_edges(im, sides):
    """Borra el contorno oscuro de los lados indicados, copiando la primera
    fila/columna "limpia" hacia afuera. El grosor se mide por borde: no es
    el mismo en todas las piezas ni en los dos ejes."""
    out = im.copy(); px = out.load(); n = CELL
    for side in sides:
        w = edge_width(im, side)
        if w == 0: continue
        for i in range(n):
            if side == 'U':
                for k in range(w): px[i, k] = px[i, w]
            elif side == 'D':
                for k in range(w): px[i, n - 1 - k] = px[i, n - 1 - w]
            elif side == 'L':
                for k in range(w): px[k, i] = px[w, i]
            elif side == 'R':
                for k in range(w): px[n - 1 - k, i] = px[n - 1 - w, i]
    return out

TREES = {k: tree_family(p, xs, ys) for k, (p, xs, ys) in TREE_SRC.items()}
for t in TREES.values():
    for k, sides in STRIP.items():
        if k in t: t[k] = strip_edges(t[k], sides)
FAMS['jgrass'] = brighten(FAMS['jgrass'])
TREES['jungle'] = brighten(TREES['jungle'], 1.38, 20)
# la fila 3 col 0 del blob no existe (es LVB): se reusa
for t in TREES.values():
    t.setdefault('LVB', t['LVM'])

# ══════════ 4. Armar tiles.png ══════════
order = []          # lista de nombres, en orden de id (id = índice+1)
images = []

for fam in ['grass', 'sand', 'snow', 'jgrass', 'cave']:
    for p in PIECES:
        order.append(f'{fam}_{p}'); images.append(FAMS[fam][p])
for k, v in SIMPLE.items():
    order.append(k); images.append(v)
for pal in ['forest', 'pradera', 'jungle']:
    for p in TREE_PIECES:
        order.append(f'{pal}_{p}'); images.append(TREES[pal][p])

COLS_TS = 8
rows_ts = math.ceil(len(images) / COLS_TS)
sheet = Image.new('RGBA', (COLS_TS * CELL, rows_ts * CELL), (0, 0, 0, 0))
for i, im in enumerate(images):
    sheet.alpha_composite(im, ((i % COLS_TS) * CELL, (i // COLS_TS) * CELL))
sheet.save(f'{OUT}/tiles.png')
print(f'tiles.png  {sheet.width}x{sheet.height}  {len(images)} tiles, {COLS_TS} cols')

# ══════════ 5. junior.png ══════════
# El modelo original trae poses sueltas de 24x36 en 7x2, con el personaje
# siempre mirando a la derecha. Acá se rearma una tira ordenada:
#   0 idle · 1-4 caminata · 5 salto · 6 golpe · 7 daño
# Las dos poses de caminata se componen: torso de la pose quieta + piernas
# abiertas de la pose de zancada (así camina con los brazos abajo, que en
# el modelo original no existe).
J = load('models/junior/junior.png')
FW, FH = 24, 36
def jf(c, r=0):
    return J.crop((c * FW, r * FH, (c + 1) * FW, (r + 1) * FH))

neutral = jf(2)      # parado, brazos abajo
stride  = jf(1)      # piernas abiertas
jump    = jf(1)      # brazos arriba + piernas abiertas
swing   = jf(3)      # un brazo en alto
hurt    = jf(4)      # brazo tapando la cara
CUT = 24             # cintura

def splice(torso, legs, mirror_legs=False, bob=0):
    out = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    top = torso.crop((0, 0, FW, CUT))
    bot = legs.crop((0, CUT, FW, FH))
    if mirror_legs:
        bot = bot.transpose(Image.FLIP_LEFT_RIGHT)
    out.alpha_composite(top, (0, bob))
    out.alpha_composite(bot, (0, CUT))
    return out

walk1 = splice(neutral, stride)
walk2 = neutral.copy()
walk3 = splice(neutral, stride, mirror_legs=True)
walk4 = neutral.copy()

frames = [neutral, walk1, walk2, walk3, walk4, jump, swing, hurt]
jsheet = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
for i, f in enumerate(frames):
    jsheet.alpha_composite(f, (i * FW, 0))
jsheet.save(f'{OUT}/junior.png')
print(f'junior.png {jsheet.width}x{jsheet.height}  {len(frames)} frames de {FW}x{FH}')

# ══════════ 6. Ítems y partículas (ya vienen a 16px) ══════════
for src, dst in [(f'{SRC}/item/tools-held.png', 'tools-held.png'),
                 (f'{SRC}/item/tools-icon.png', 'tools-icon.png'),
                 (f'{SRC}/particle/cracks.png', 'cracks.png')]:
    im = load(src); im.save(f'{OUT}/{dst}')
    print(f'{dst} {im.width}x{im.height}')

# ══════════ 7. Portada ══════════
# Escena armada con los mismos tiles + Junior, para que el menú no quede
# con el placeholder.
def cover():
    W, H = 480, 210
    im = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(96 + 110 * t), int(178 + 50 * t), int(220 - 10 * t), 255))
    rnd = random.Random(7)
    surf = [0] * (W // CELL + 1)
    for c in range(len(surf)):
        surf[c] = 8 + int(round(1.6 * math.sin(c * 0.5) + 1.1 * math.sin(c * 0.17 + 1)))
    def put(t, c, r):
        if 0 <= r <= H // CELL: im.alpha_composite(t, (c * CELL, r * CELL))
    G = FAMS['grass']
    for c in range(len(surf)):
        s = surf[c]
        put(G['T'], c, s)
        for r in range(s + 1, H // CELL + 1):
            put(G['C'] if r < s + 4 else STONE, c, r)
    # tres árboles con las tres paletas
    for c, pal, h in [(3, 'forest', 5), (12, 'pradera', 4), (24, 'jungle', 6)]:
        P = TREES[pal]; s = surf[c]
        put(P['TRUNK_BASE'], c, s - 1)
        for k in range(2, h): put(P['TRUNK_K'] if k % 3 == 0 else P['TRUNK'], c, s - k)
        put(P['LCAN'], c, s - h)
        for dc in (-1, 0, 1):
            put(P['LB'] if dc == 0 else (P['LBL'] if dc < 0 else P['LBR']), c + dc, s - h - 1)
        for dc in (-1, 0, 1):
            put(P['LT'] if dc == 0 else (P['LTL'] if dc < 0 else P['LTR']), c + dc, s - h - 2)
    # Junior parado en el medio
    im.alpha_composite(neutral.resize((FW * 2, FH * 2), Image.NEAREST),
                       (W // 2 - FW, surf[W // 2 // CELL] * CELL - FH * 2))
    return im.convert('RGB')

cover().save(f'{OUT}/portada.png')
print('portada.png 480x210')

# ══════════ 8. Orden de tiles para survi_config.js ══════════
with open('out/tile_order.json', 'w') as f:
    json.dump({'cols': COLS_TS, 'count': len(order), 'order': order}, f, indent=1)
print('\n--- orden ---')
for i, n in enumerate(order):
    print(f'{i+1:3d} {n}')
