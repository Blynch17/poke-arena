"""Dibuja al entrenador, un huaso chileno (diseño original), como sprite de mundo: 4 direcciones x 3 cuadros de caminata.

Hoja de 96x128 px (cada cuadro de 32x32): columnas = quieto, paso A, paso B; filas = abajo, arriba, izquierda, derecha.
La derecha es la izquierda espejada. Estilo: proporciones chibi y contorno oscuro, como los sprites pequeños de mundo.

Uso: python3 -I tools/make_trainer_sprite.py
Genera public/sprites/trainer-walk.png y la vista previa docs/trainer-preview.png y docs/trainer-preview.gif.
"""
from PIL import Image, ImageDraw

N = 32
OUT = (0x1B, 0x15, 0x20)

# Paleta del huaso: sombrero negro de ala ancha, manta de franjas negras, rojas y blancas, camisa blanca,
# pantalón negro y botas altas con flecos.
SKIN, SKIN_D = (0xD9, 0xA7, 0x7E), (0xB9, 0x86, 0x60)
HAIR = (0x1B, 0x15, 0x20)
HAT, HAT_L = (0x1E, 0x1E, 0x26), (0x44, 0x44, 0x50)
SHIRT, SHIRT_D = (0xF4, 0xF1, 0xEA), (0xCF, 0xC9, 0xBD)
PONCHO, PONCHO_L = (0x22, 0x22, 0x2A), (0x3A, 0x3A, 0x46)
RED, RED_D = (0xB3, 0x22, 0x2B), (0x73, 0x14, 0x1A)
WHITE = (0xF2, 0xEF, 0xE8)
PANTS, PANTS_D = (0x26, 0x26, 0x2E), (0x18, 0x18, 0x20)
BOOT, BOOT_L = (0x2A, 0x2A, 0x34), (0x66, 0x66, 0x76)
FRINGE, SOLE = (0x9A, 0x9A, 0xAA), (0x5A, 0x3A, 0x28)
EYE, MOUTH = (0x2A, 0x20, 0x30), (0x8A, 0x3F, 0x3A)
BLUE = (0x1F, 0x3F, 0x9A)

# Franja del sombrero, de arriba hacia abajo; la última fila queda justo sobre el ala (y = 6).
HAT_BAND = [RED, WHITE, BLUE]


class Pix:
    def __init__(self):
        self.p = {}

    def set(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < N and 0 <= y < N:
            self.p[(x, y)] = c

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, c)

    def ell(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    self.set(x, y, c)

    def outline(self):
        out = dict(self.p)
        for y in range(N):
            for x in range(N):
                if (x, y) in self.p:
                    continue
                if any((x + dx, y + dy) in self.p for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out[(x, y)] = OUT
        self.p = out

    def flip(self):
        q = Pix()
        q.p = {(N - 1 - x, y): c for (x, y), c in self.p.items()}
        return q

    def image(self):
        im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        for (x, y), c in self.p.items():
            im.putpixel((x, y), (*c, 255))
        return im


# f: 0 = quieto, 1 = paso A, 2 = paso B. Al caminar el torso sube 1 px (rebote) y las piernas se alternan.
def hat_band(p, b, x0, x1):
    """Franja de colores alrededor de la base de la copa."""
    top = 7 - len(HAT_BAND)
    for i, c in enumerate(HAT_BAND):
        p.rect(x0, top + i + b, x1 - x0 + 1, 1, c)


def cloth(p, x, y):
    """Pañuelo blanco agarrado: (x, y) es la esquina de la mano; el pañuelo asoma y cuelga debajo del puño."""
    p.rect(x, y + 2, 4, 2, WHITE)
    p.rect(x + 1, y + 4, 2, 1, WHITE)
    p.set(x + 3, y + 3, SHIRT_D); p.set(x + 2, y + 4, SHIRT_D)


STRIPES = [RED, WHITE, PONCHO, PONCHO, RED, PONCHO, WHITE, RED]   # franjas de la manta, de arriba a abajo


def legs_front(p, f):
    lift_l, lift_r = (1 if f == 1 else 0), (1 if f == 2 else 0)
    for x, lift in ((12, lift_l), (16, lift_r)):
        p.rect(x, 24 - lift, 4, 2, PANTS)
        p.rect(x, 25 - lift, 4, 4, BOOT); p.rect(x, 25 - lift, 4, 1, BOOT_L)      # bota alta con borde claro
        p.rect(x + 1, 26 - lift, 1, 3, BOOT_L)                                   # brillo del cuero
        p.rect(x - 1 if x == 12 else x + 4, 26 - lift, 1, 3, FRINGE)              # flecos al costado de la bota
        p.rect(x - (1 if x == 12 else 0), 29 - lift, 5, 1, SOLE)


def poncho(p, x, w, b, side=False):
    """Manta cuadrada con borde rojo y franjas; colgando sobre el torso."""
    for i, c in enumerate(STRIPES):
        p.rect(x, 16 + b + i, w, 1, c)
    p.rect(x, 17 + b, 1, 7, RED); p.rect(x + w - 1, 17 + b, 1, 7, RED)              # bordes laterales rojos
    p.rect(x + 1, 18 + b, 1, 5, PONCHO_L)                                           # pliegue
    for fx in range(x + 1, x + w - 1, 2):                                           # flecos del borde inferior
        p.set(fx, 24 + b, WHITE if not side else SHIRT_D)


def poncho_side(p, b):
    """Manta de perfil: cubre los hombros y cuelga solo por delante y por detrás; por el costado se ve la camisa."""
    for i in (0, 1):                                    # sobre los hombros, de lado a lado
        p.rect(11, 16 + b + i, 10, 1, STRIPES[i])
    for i in range(2, 8):                               # paneles colgantes: delantero (izquierda) y trasero (derecha)
        p.rect(11, 16 + b + i, 3, 1, STRIPES[i])
        p.rect(18, 16 + b + i, 3, 1, STRIPES[i])
    p.rect(11, 17 + b, 1, 7, RED); p.rect(20, 17 + b, 1, 7, RED)       # borde rojo exterior de cada panel
    p.rect(13, 18 + b, 1, 5, PONCHO_L); p.rect(18, 18 + b, 1, 5, PONCHO_L)
    for fx in (11, 13, 18, 20):                          # flecos del borde inferior
        p.set(fx, 24 + b, WHITE)


def head_front(p, b):
    p.ell(16, 11.5 + b, 5.6, 5.4, SKIN)
    p.rect(10, 8 + b, 12, 3, HAIR)                          # pelo negro bajo el ala
    p.rect(11, 10 + b, 10, 6, SKIN)                         # cara
    p.rect(10, 10 + b, 1, 3, HAIR); p.rect(21, 10 + b, 1, 3, HAIR)   # patillas
    p.rect(13, 11 + b, 2, 2, EYE); p.rect(17, 11 + b, 2, 2, EYE)
    p.set(13, 11 + b, WHITE); p.set(17, 11 + b, WHITE)
    p.rect(11, 14 + b, 1, 1, SKIN_D); p.rect(20, 14 + b, 1, 1, SKIN_D)
    p.rect(14, 15 + b, 4, 1, MOUTH); p.set(13, 14 + b, MOUTH); p.set(18, 14 + b, MOUTH)   # sonrisa
    # sombrero: copa baja y plana y ala muy ancha
    p.ell(16, 7 + b, 10.5, 2.0, HAT)
    p.rect(11, 2 + b, 10, 5, HAT); p.rect(12, 1 + b, 8, 1, HAT)
    p.rect(12, 2 + b, 8, 1, HAT_L); p.rect(7, 7 + b, 18, 1, HAT_L)
    hat_band(p, b, 11, 20)


def front(f):
    p = Pix()
    b = -1 if f else 0
    la, ra = (1, 0) if f == 1 else (0, 1) if f == 2 else (0, 0)
    legs_front(p, f)
    # mangas blancas y manos
    p.rect(7, 19 + b + la, 2, 5, SHIRT); p.rect(7, 24 + b + la, 2, 2, SKIN); p.rect(7, 21 + b + la, 1, 3, SHIRT_D)
    p.rect(23, 19 + b + ra, 2, 5, SHIRT); p.rect(23, 24 + b + ra, 2, 2, SKIN); p.rect(24, 21 + b + ra, 1, 3, SHIRT_D)
    cloth(p, 23, 24 + b + ra)                                                # pañuelo en la mano
    p.rect(12, 17 + b, 8, 7, SHIRT)
    poncho(p, 9, 14, b)
    p.rect(14, 16 + b, 4, 1, SHIRT); p.rect(15, 16 + b, 2, 1, SKIN)          # cuello abierto
    head_front(p, b)
    return p


def back(f):
    p = Pix()
    b = -1 if f else 0
    la, ra = (1, 0) if f == 1 else (0, 1) if f == 2 else (0, 0)
    legs_front(p, f)
    p.rect(7, 19 + b + la, 2, 5, SHIRT); p.rect(7, 24 + b + la, 2, 2, SKIN)
    p.rect(23, 19 + b + ra, 2, 5, SHIRT); p.rect(23, 24 + b + ra, 2, 2, SKIN)
    cloth(p, 23, 24 + b + ra)
    p.rect(12, 17 + b, 8, 7, SHIRT)
    poncho(p, 9, 14, b)
    p.rect(15, 16 + b, 2, 1, SKIN_D)
    p.ell(16, 11.5 + b, 5.6, 5.4, SKIN)
    p.rect(10, 8 + b, 12, 7, HAIR)                          # nuca con pelo negro
    p.rect(12, 15 + b, 8, 1, HAIR)
    p.ell(16, 7 + b, 10.5, 2.0, HAT)
    p.rect(11, 2 + b, 10, 5, HAT); p.rect(12, 1 + b, 8, 1, HAT)
    p.rect(12, 2 + b, 8, 1, HAT_L); p.rect(7, 7 + b, 18, 1, HAT_L)
    hat_band(p, b, 11, 20)
    return p


def left(f):
    p = Pix()
    b = -1 if f else 0
    # piernas de perfil: una al frente y otra atrás al caminar
    if f == 0:
        legs = [(16, PANTS_D, BOOT), (13, PANTS, BOOT)]
    elif f == 1:
        legs = [(17, PANTS_D, BOOT), (11, PANTS, BOOT)]
    else:
        legs = [(11, PANTS_D, BOOT), (17, PANTS, BOOT)]
    for lx, pc, bc in legs:
        p.rect(lx, 24, 4, 2, pc)
        p.rect(lx, 25, 4, 4, bc); p.rect(lx, 25, 4, 1, BOOT_L)
        p.rect(lx + 4, 26, 1, 3, FRINGE)                  # flecos hacia atrás
        p.rect(lx - 1, 29, 6, 1, SOLE)
    p.rect(12, 17 + b, 8, 7, SHIRT); p.rect(12, 17 + b, 1, 7, SHIRT_D); p.rect(19, 17 + b, 1, 7, SHIRT_D)
    poncho_side(p, b)
    p.rect(13, 16 + b, 4, 1, SHIRT)
    # brazo delantero con balanceo (manga blanca y mano)
    arm = {0: 0, 1: -2, 2: 2}[f]
    p.rect(13 + arm, 20 + b, 3, 4, SHIRT_D); p.rect(14 + arm, 20 + b, 1, 4, SHIRT)   # manga con bordes sombreados
    p.rect(13 + arm, 23 + b, 3, 1, SHIRT_D)                                        # puño de la manga
    p.rect(13 + arm, 24 + b, 3, 2, SKIN)
    cloth(p, 12 + arm, 24 + b)                              # el pañuelo cuelga del puño
    # cabeza de perfil con sombrero
    p.ell(15, 11.5 + b, 5.2, 5.4, SKIN)
    p.rect(14, 8 + b, 7, 8, HAIR)                           # pelo detrás
    p.rect(10, 10 + b, 5, 6, SKIN)                          # cara hacia la izquierda
    p.rect(9, 12 + b, 1, 3, SKIN)                           # nariz
    p.rect(14, 13 + b, 1, 2, SKIN_D)                        # oreja
    p.rect(11, 11 + b, 2, 2, EYE); p.set(11, 11 + b, WHITE)
    p.rect(10, 15 + b, 3, 1, MOUTH); p.set(10, 14 + b, MOUTH)
    p.ell(15, 7 + b, 9.5, 2.0, HAT)
    p.rect(11, 2 + b, 9, 5, HAT); p.rect(12, 1 + b, 7, 1, HAT)
    p.rect(12, 2 + b, 7, 1, HAT_L); p.rect(7, 7 + b, 17, 1, HAT_L)
    hat_band(p, b, 11, 19)
    return p


DRAW = [front, back, left]
COLS = 3


def finished(row, f):
    if row == 3:
        p = left(f); p.outline(); return p.flip()
    p = DRAW[row](f); p.outline(); return p


def build_sheet():
    sheet = Image.new('RGBA', (N * COLS, N * 4), (0, 0, 0, 0))
    for row in range(4):
        for f in range(COLS):
            sheet.paste(finished(row, f).image(), (f * N, row * N))
    return sheet


def preview(sheet, scale=6):
    names = ['Abajo', 'Arriba', 'Izquierda', 'Derecha']
    bg = (59, 96, 68, 255)
    w, h = N * COLS * scale, N * 4 * scale
    im = Image.new('RGBA', (w + 150, h), bg)
    big = sheet.resize((w, h), Image.NEAREST)
    im.paste(big, (150, 0), big)
    d = ImageDraw.Draw(im)
    for r, n in enumerate(names):
        d.text((12, r * N * scale + N * scale // 2 - 6), n, fill=(255, 255, 255, 255))
    return im


def gif(sheet, path, scale=8):
    # un recorrido por cada dirección: quieto, paso A, quieto, paso B
    seq = [0, 1, 0, 2]
    frames = []
    for k in range(len(seq) * 2):
        f = seq[k % 4]
        canvas = Image.new('RGBA', (N * 4 * scale, N * scale), (59, 96, 68, 255))
        for row in range(4):
            tile = sheet.crop((f * N, row * N, f * N + N, row * N + N)).resize((N * scale, N * scale), Image.NEAREST)
            canvas.paste(tile, (row * N * scale, 0), tile)
        frames.append(canvas.convert('P', palette=Image.ADAPTIVE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=170, loop=0, disposal=2)


if __name__ == '__main__':
    sheet = build_sheet()
    sheet.save('public/sprites/trainer-walk.png')
    preview(sheet).save('docs/trainer-preview.png')
    gif(sheet, 'docs/trainer-preview.gif')
    print('ok', sheet.size)
