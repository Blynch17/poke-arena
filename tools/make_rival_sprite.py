"""Dibuja al entrenador rival de la ruta: el mismo molde del huaso con otra paleta (sombrero de paja, manta verde y amarilla).

Uso: python3 -I tools/make_rival_sprite.py
Genera public/sprites/trainer-rival.png (misma hoja de 96x128 que trainer-walk.png).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_trainer_sprite as m  # noqa: E402

GREEN, GREEN_D = (0x2F, 0x7A, 0x4A), (0x1C, 0x4D, 0x2E)
GOLD = (0xE0, 0xB0, 0x30)
STRAW, STRAW_L = (0xC9, 0xA4, 0x5C), (0xE6, 0xCB, 0x86)

m.HAT, m.HAT_L = STRAW, STRAW_L
m.HAT_BAND = [GREEN, GOLD, GREEN]
m.PONCHO, m.PONCHO_L = GREEN, (0x3E, 0x96, 0x5C)
m.RED, m.RED_D = GOLD, (0x9A, 0x74, 0x1A)
m.STRIPES[:] = [m.RED, m.WHITE, m.PONCHO, m.PONCHO, m.RED, m.PONCHO, m.WHITE, m.RED]
m.SHIRT, m.SHIRT_D = (0xBF, 0xDD, 0xF2), (0x93, 0xB4, 0xD0)
m.PANTS, m.PANTS_D = (0x5A, 0x42, 0x2C), (0x3E, 0x2C, 0x1C)
m.BOOT, m.BOOT_L = (0x4A, 0x32, 0x20), (0x86, 0x62, 0x40)
m.HAIR = (0x5A, 0x32, 0x1A)
m.SKIN, m.SKIN_D = (0xE6, 0xB8, 0x90), (0xC4, 0x93, 0x6C)

if __name__ == '__main__':
    m.build_sheet().save('public/sprites/trainer-rival.png')
    print('ok')
