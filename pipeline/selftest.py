# ==========================================
# SELF-TEST
# Checks the pixel checks on drawings made in memory (a clean curve, a coloured curve,
# shading, text-like specks ...). Nothing is saved or shown. Run: python pipeline/selftest.py
# ==========================================
import math
import random

from PIL import Image, ImageDraw

import quality

SIZE = 900


def blank():
    image = Image.new('RGB', (SIZE, SIZE), 'white')
    return image, ImageDraw.Draw(image)


def wavy_line(draw, colour, width=5):
    points = [(60 + i * 8, 450 + 180 * math.sin(i / 14) * math.cos(i / 40)) for i in range(100)]
    draw.line(points, fill=colour, width=width, joint='curve')


def clean_line():
    image, draw = blank()
    wavy_line(draw, 'black')
    return image


def coloured_line():
    image, draw = blank()
    wavy_line(draw, (220, 30, 30))
    return image


def shaded():
    image, draw = blank()
    wavy_line(draw, 'black')
    for x in range(SIZE):  # soft grey gradient across the picture
        draw.line([(x, 0), (x, SIZE)], fill=(int(255 - 120 * x / SIZE),) * 3)
    wavy_line(draw, 'black')
    return image


def text_like():
    image, draw = blank()
    random.seed(1)
    for _ in range(120):  # many small separate marks
        x, y = random.randint(20, SIZE - 40), random.randint(20, SIZE - 40)
        draw.rectangle([x, y, x + 12, y + 18], outline='black', width=3)
    return image


def solid_blob():
    image, draw = blank()
    draw.ellipse([150, 150, 750, 750], fill='black')
    return image


def nothing():
    return blank()[0]


def thick_and_thin():
    image, draw = blank()
    wavy_line(draw, 'black', width=3)
    draw.line([(100, 800), (800, 800)], fill='black', width=40)
    return image


CASES = [  # (name, picture, expected reason or None for "should pass")
    ('clean_line', clean_line(), None),
    ('coloured_line', coloured_line(), 'colour'),
    ('shaded', shaded(), 'shading'),
    ('text_like', text_like(), 'too_many_shapes'),
    ('solid_blob', solid_blob(), 'heavy_fill'),
    ('nothing', nothing(), 'nearly_blank'),
    ('thick_and_thin', thick_and_thin(), 'uneven_line'),
]

failures = 0
for name, picture, expected in CASES:
    measures = quality.measure(picture)
    reasons = quality.decide(measures)
    good = (not reasons) if expected is None else (expected in reasons)
    failures += not good
    print(f"{'ok  ' if good else 'FAIL'} {name:15} reasons={reasons or 'none'}  {measures}")
raise SystemExit(failures)
