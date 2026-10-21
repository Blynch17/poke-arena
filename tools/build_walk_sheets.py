"""Convierte los GIF de sprites-tcrf/ (HGSS, 2 cuadros por dirección) en una hoja por Pokémon.

Hoja: 64x128 px. Columnas = 2 cuadros. Filas = abajo (S), arriba (N), izquierda (W), derecha (E).
El 2º cuadro de cada GIF trae el fondo negro opaco: se quita y se rehace el contorno negro.
Uso: python3 -I tools/build_walk_sheets.py  (los GIF de sprites-tcrf/ no se suben al repo)
"""
import glob
from collections import deque
from PIL import Image

POKEMON = ['venusaur', 'charizard', 'blastoise', 'pikachu', 'alakazam', 'gengar']
DIRS = ['S', 'N', 'W', 'E']  # abajo, arriba, izquierda, derecha
SIZE = 32


def frame_rgba(gif, i):
    gif.seek(i)
    return gif.convert('RGBA')


def clear_black_background(img):
    """Quita el negro conectado con el borde y vuelve a dibujar un contorno de 1 px."""
    w, h = img.size
    px = img.load()
    seen = [[False] * h for _ in range(w)]
    q = deque((x, y) for x in range(w) for y in range(h) if x in (0, w - 1) or y in (0, h - 1))
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[x][y]:
            continue
        if px[x, y][:3] != (0, 0, 0):
            continue
        seen[x][y] = True
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    body = [[px[x, y][3] > 0 for y in range(h)] for x in range(w)]
    for x in range(w):
        for y in range(h):
            if body[x][y]:
                continue
            near = any(
                0 <= x + dx < w and 0 <= y + dy < h and body[x + dx][y + dy]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if near:
                px[x, y] = (0, 0, 0, 255)
    return img


for name in POKEMON:
    sheet = Image.new('RGBA', (SIZE * 2, SIZE * 4), (0, 0, 0, 0))
    for row, d in enumerate(DIRS):
        files = sorted(glob.glob(f'sprites-tcrf/PokeHGSS_Follow_{name.capitalize()}_*{d}_r*.gif'))
        files = [f for f in files if f.split(f'{name.capitalize()}_')[1].split('_r')[0] in (d, f'Fe_{d}')]
        if not files:
            raise SystemExit(f'Falta {name} {d}')
        gif = Image.open(files[0])
        for col in range(2):
            fr = frame_rgba(gif, col % gif.n_frames)
            if col > 0:
                fr = clear_black_background(fr)
            sheet.paste(fr, (col * SIZE, row * SIZE))
    sheet.save(f'public/sprites/{name}-walk.png')
    print('ok', name)
