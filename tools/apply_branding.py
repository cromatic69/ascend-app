"""Gives the generated Android project the Ascend icon, splash screen and vibration permission."""
import os
from PIL import Image, ImageDraw
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
main = os.path.join(root, 'android', 'app', 'src', 'main')
res = os.path.join(main, 'res')
logo = Image.open(os.path.join(root, 'www', 'img', 'ic-logo.webp')).convert('RGBA')
BG = (7, 10, 18, 255)

def fit(img, box, pad):
    w = int(box * pad); h = round(img.height * w / img.width)
    if h > box * pad:
        h = int(box * pad); w = round(img.width * h / img.height)
    return img.resize((w, h), Image.LANCZOS)

def paste_center(canvas, img):
    canvas.alpha_composite(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2))

for d in os.listdir(res):
    if d.startswith('mipmap-') and d != 'mipmap-anydpi-v26':
        for f in os.listdir(os.path.join(res, d)):
            p = os.path.join(res, d, f)
            if not f.endswith('.png'): continue
            sz = Image.open(p).size[0]
            if f == 'ic_launcher_foreground.png':
                c = Image.new('RGBA', (sz, sz), (0, 0, 0, 0)); paste_center(c, fit(logo, sz, .5))
            else:
                c = Image.new('RGBA', (sz, sz), BG); paste_center(c, fit(logo, sz, .74))
                if f == 'ic_launcher_round.png':
                    m = Image.new('L', (sz, sz), 0); ImageDraw.Draw(m).ellipse((0, 0, sz - 1, sz - 1), fill=255); c.putalpha(m)
            c.save(p)
    if d.startswith('drawable'):
        p = os.path.join(res, d, 'splash.png')
        if os.path.exists(p):
            w, h = Image.open(p).size
            c = Image.new('RGBA', (w, h), BG); paste_center(c, fit(logo, min(w, h), .5)); c.save(p)

with open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#070A12</color>\n</resources>\n')

mp = os.path.join(main, 'AndroidManifest.xml')
m = open(mp).read()
if 'VIBRATE' not in m:
    m = m.replace('<uses-permission android:name="android.permission.INTERNET" />',
                  '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.VIBRATE" />')
    open(mp, 'w').write(m)
print('Branding applied')
