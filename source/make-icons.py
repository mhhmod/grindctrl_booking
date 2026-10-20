"""Generate the two line icons that the 2026-10-20 polish pass requires.

icon-reject.png  replaces the phone-hang-up glyph previously reused for the
                 manager "Reject" action in S06.
icon-mic.png     was referenced by build-pptx.py (narration marker on slide 1)
                 but missing from the delivered package.
Drawn at 4x and downsampled for anti-aliasing; colours match the existing set.
"""
from pathlib import Path
from PIL import Image, ImageDraw

R = Path(__file__).parent / 'assets'
ACCENT = (186, 76, 36, 255)
INK = (38, 38, 38, 255)


def canvas(n=216, k=4):
    im = Image.new('RGBA', (n * k, n * k), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im), n * k / 24  # 24-unit grid like the SVG icons


def save(im, name, n=216):
    im.resize((n, n), Image.LANCZOS).save(R / name)


# Reject: circle with an X, same 1.6 stroke weight as the bundled SVG icons.
im, d, u = canvas()
w = round(1.6 * u)
d.ellipse([3 * u, 3 * u, 21 * u, 21 * u], outline=ACCENT, width=w)
d.line([9 * u, 9 * u, 15 * u, 15 * u], fill=ACCENT, width=w)
d.line([15 * u, 9 * u, 9 * u, 15 * u], fill=ACCENT, width=w)
save(im, 'icon-reject.png')

# Microphone marker for the embedded narration on PowerPoint slide 1.
im, d, u = canvas()
d.rounded_rectangle([9 * u, 3 * u, 15 * u, 14 * u], radius=3 * u, outline=INK, width=w)
d.arc([6 * u, 7 * u, 18 * u, 17 * u], start=0, end=180, fill=INK, width=w)
d.line([12 * u, 17 * u, 12 * u, 21 * u], fill=INK, width=w)
d.line([9 * u, 21 * u, 15 * u, 21 * u], fill=INK, width=w)
save(im, 'icon-mic.png')
print('icon-reject.png and icon-mic.png written')
