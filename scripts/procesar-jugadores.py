"""Prepara las texturas de los futbolistas realistas (Microsoft Rocketbox, licencia MIT).

- Borra el diseño original de la camiseta/short/medias (rayas, números, publicidad), pero conserva
  los pliegues y el sombreado de la tela, para que el juego pinte encima los colores de cada club.
- Guarda en el canal alfa la "zona" de cada píxel: 0 = piel/zapatos (se deja igual),
  64 = medias, 128 = short, 192 = camiseta, 255 = detalles (cuello y bordes).
- Reduce el tamaño de las texturas para que el juego cargue rápido.

Uso:  python3 scripts/procesar-jugadores.py <carpeta_rocketbox> <carpeta_zonas> <salida>
(la carpeta de zonas la genera el paso de conversión: un PNG por modelo con las zonas pintadas)
"""
import sys
import os
import numpy as np
from PIL import Image, ImageFilter  # noqa: F401

RB, ZONAS, SALIDA = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(SALIDA, exist_ok=True)

MODELOS = {
    'jugador_a': ('Sports_Male_02', 'm301'),
    'jugador_b': ('Sports_Male_03', 'm300'),
}
TAM = 1024


def caja(a, r):
    """Desenfoque de caja separable (con sumas acumuladas)."""
    for eje in (0, 1):
        p = np.pad(a, [(r + 1, r) if e == eje else (0, 0) for e in (0, 1)], mode='edge')
        c = np.cumsum(p, axis=eje)
        if eje == 0:
            a = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
        else:
            a = (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
    return a


def desenfoque(a, radio):
    r = max(1, int(radio * 0.6))
    for _ in range(3):
        a = caja(a, r)
    return a


def desenfoque_normalizado(valor, peso, radio):
    """Promedio local de 'valor' considerando solo los píxeles con peso (convolución normalizada)."""
    v = desenfoque(valor * peso, radio)
    w = desenfoque(peso, radio)
    return v / np.maximum(w, 1e-4), w


def erosionar(m, n=2):
    img = Image.fromarray((m * 255).astype(np.uint8))
    for _ in range(n):
        img = img.filter(ImageFilter.MinFilter(3))
    return np.asarray(img) > 127


for nombre, (carpeta, pref) in MODELOS.items():
    base = os.path.join(RB, 'Assets/Avatars/Professions', carpeta, 'Textures')
    color = Image.open(os.path.join(base, f'{pref}_body_color.tga')).convert('RGB').resize((TAM, TAM), Image.LANCZOS)
    zonas = Image.open(os.path.join(ZONAS, f'{carpeta}_zonas.png')).convert('RGB').resize((TAM, TAM), Image.NEAREST)
    c = np.asarray(color).astype(np.float32) / 255
    z = np.asarray(zonas)
    H = W = TAM
    yy, xx = np.mgrid[0:H, 0:W] / TAM
    camiseta = (z[..., 0] > 128) & (z[..., 1] > 128) & (z[..., 2] < 128)
    short = (z[..., 2] > 128) & (z[..., 0] < 128)
    media = (z[..., 1] > 128) & (z[..., 0] < 128) & (z[..., 2] < 128)
    # Corrección por bloques del atlas: los bloques de arriba a los lados son el short completo
    bloque_short = (yy < 0.19) & ((xx < 0.29) | (xx > 0.71))
    short |= bloque_short
    camiseta &= ~bloque_short
    # La columna central del atlas es siempre camiseta (en un modelo el borde inferior queda marcado como short)
    columna = short & (xx > 0.3) & (xx < 0.7)
    camiseta |= columna
    short &= ~columna

    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx, mn = c.max(-1), c.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    hue = np.zeros_like(mx)
    d = np.maximum(mx - mn, 1e-4)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    piel = (hue < 48) & (sat > 0.16) & (sat < 0.78) & (mx > 0.1) & (r >= g) & (g >= b * 0.85)
    naranja = (hue > 2) & (hue < 30) & (sat > 0.72) & (mx > 0.55)
    # El logo de publicidad y el escudo NO son bordes: se tratan como tela (se borran)
    logo = (xx > 0.40) & (xx < 0.60) & (yy > 0.53) & (yy < 0.69)
    detalle = naranja & ~logo & (yy < 0.75)
    tela = ((camiseta | short | media) & ~(piel & ~naranja)) | detalle | (logo & camiseta)
    camiseta |= detalle

    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # Sombreado: cada "clase" de color (claro, oscuro, naranja) se normaliza por su promedio local.
    sombra = np.ones_like(lum)
    confiable = np.zeros_like(lum, dtype=bool)
    clases = [tela & ~naranja & (lum > 0.42), tela & ~naranja & (lum <= 0.42), tela & naranja]
    for m in clases:
        interior = erosionar(m, 3) & ~logo
        prom, _ = desenfoque_normalizado(lum, interior.astype(np.float32), 10)
        s = np.clip(lum / np.maximum(prom, 0.02), 0.55, 1.3)
        sombra = np.where(interior, s, sombra)
        confiable |= interior
    # Rellena bordes entre rayas, textos y logos con el sombreado vecino
    relleno, w1 = desenfoque_normalizado(sombra, confiable.astype(np.float32), 6)
    lejano, w2 = desenfoque_normalizado(sombra, confiable.astype(np.float32), 45)
    relleno = np.where(w1 > 0.25, relleno, np.where(w2 > 0.02, lejano, 1.0))
    sombra = np.where(confiable, sombra, relleno)
    sombra = np.clip(sombra, 0.6, 1.2)

    salida = c.copy()
    gris = np.clip(sombra * 0.82, 0, 1)
    for k in range(3):
        salida[..., k] = np.where(tela, gris, c[..., k])
    alfa = np.zeros((H, W), np.uint8)
    alfa[tela & media] = 64
    alfa[tela & short] = 128
    alfa[tela & camiseta] = 192
    alfa[detalle] = 255
    rgba = np.dstack([(salida * 255).astype(np.uint8), alfa])
    Image.fromarray(rgba, 'RGBA').save(os.path.join(SALIDA, f'{nombre}_cuerpo.png'))
    # Normales del cuerpo (pliegues) y cabeza
    Image.open(os.path.join(base, f'{pref}_body_normal.tga')).convert('RGB').resize((TAM, TAM), Image.LANCZOS).save(os.path.join(SALIDA, f'{nombre}_cuerpo_normal.png'))
    Image.open(os.path.join(base, f'{pref}_head_color.tga')).convert('RGB').resize((TAM, TAM), Image.LANCZOS).save(os.path.join(SALIDA, f'{nombre}_cabeza.png'))
    Image.open(os.path.join(base, f'{pref}_head_normal.tga')).convert('RGB').resize((TAM // 2, TAM // 2), Image.LANCZOS).save(os.path.join(SALIDA, f'{nombre}_cabeza_normal.png'))
    op = os.path.join(base, f'{pref}_opacity_color.tga')
    if os.path.exists(op):
        Image.open(op).convert('RGBA').resize((TAM // 2, TAM // 2), Image.LANCZOS).save(os.path.join(SALIDA, f'{nombre}_pelo.png'))
    print('listo', nombre)
