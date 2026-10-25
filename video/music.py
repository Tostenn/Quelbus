"""Musique de la vidéo QuelBus, synthétisée de zéro (libre de droits).

120 BPM : une mesure = 2 s, les changements de scène tombent sur les mesures.
Marimba + nappe + basse + percussions légères, en fa majeur.
Les petits sons (taps, pops, impact du logo) sont calés sur la timeline de scene.template.html.

    python3 music.py            # écrit music.wav
"""
import numpy as np
import wave

SR = 44100
DUR = 31.5
N = int(SR * DUR)
rng = np.random.default_rng(7)
BEAT = 0.5  # 120 BPM


def tt(d):
    return np.arange(int(SR * d)) / SR


def note(name):
    names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


class Bus:
    def __init__(self):
        self.l = np.zeros(N)
        self.r = np.zeros(N)

    def add(self, sig, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        if i >= N:
            return
        sig = sig[: N - i] * gain
        self.l[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
        self.r[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2)


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if hi:
        m *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo:
        m *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X * m, len(x))


def reverb(x, secs=1.8, mix=0.25):
    ir_t = tt(secs)
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4.0)
    ir = fft_filter(ir, lo=200, hi=6000)
    ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + len(ir)
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
    return x * (1 - mix) + y * mix * 3


# ---------- instruments ----------
def marimba(f, d=0.9):
    t = tt(d)
    env = np.exp(-t * 7) * np.minimum(1, t / 0.002)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t * 25)
    s += 0.12 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t * 60)
    return s * env


def pad(freqs, d, att=0.6, rel=0.8):
    t = tt(d)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ph = rng.random() * 6.28
            ff = f * 2 ** (det / 12)
            # dent de scie douce (5 harmoniques)
            for k in range(1, 6):
                s += np.sin(2 * np.pi * ff * k * t + ph * k) / (k ** 1.6)
    env = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel)
    return fft_filter(s * env, hi=1800) / (len(freqs) * 3)


def bass(f, d=0.45):
    t = tt(d)
    env = np.exp(-t * 4) * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.03)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return np.tanh(1.6 * s) * env


def kick(d=0.4):
    t = tt(d)
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * np.minimum(1, t / 0.001)


def shaker(d=0.07, bright=7000):
    t = tt(d)
    n = rng.standard_normal(len(t))
    return fft_filter(n, lo=bright) * np.exp(-t * 60) * np.minimum(1, t / 0.004)


def clap(d=0.25):
    t = tt(d)
    n = fft_filter(rng.standard_normal(len(t)), lo=900, hi=5000)
    env = np.exp(-t * 22)
    for k in (0.0, 0.012, 0.024):  # trois micro-attaques
        env += (t > k) * np.exp(-(t - k) * 120) * 0.6
    return n * env


def click(f=2400, d=0.05):
    t = tt(d)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 90) + 0.4 * fft_filter(rng.standard_normal(len(t)), lo=3000) * np.exp(-t * 200)


def pop(f=700, d=0.18):
    t = tt(d)
    ff = f * (1 + 0.8 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 18)


def riser(d=1.6):
    t = tt(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(t)
    seg = len(t) // 8
    for i in range(8):  # filtre qui s'ouvre par paliers lissés
        part = fft_filter(n, lo=300 + i * 500, hi=1500 + i * 1500)
        w = np.clip(1 - np.abs(np.arange(len(t)) - (i + 0.5) * seg) / seg, 0, 1)
        out += part * w
    return out * (t / d) ** 2


def impact(d=2.5):
    t = tt(d)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 12)) / SR) * np.exp(-t * 2.2)
    air = fft_filter(rng.standard_normal(len(t)), lo=2500) * np.exp(-t * 3) * 0.25
    return boom + air


# ---------- partition ----------
CH = {
    'F': ['F3', 'A3', 'C4'], 'C': ['E3', 'G3', 'C4'], 'Dm': ['D3', 'F3', 'A3'],
    'Bb': ['D3', 'F3', 'Bb3'], 'Csus': ['F3', 'G3', 'C4'], 'Gm': ['D3', 'G3', 'Bb3'],
}
ROOT = {'F': 'F1', 'C': 'C2', 'Dm': 'D2', 'Bb': 'Bb1', 'Csus': 'C2', 'Gm': 'G1'}

drums, music, sfx = Bus(), Bus(), Bus()

# intro (0-4) : question, accords mineurs, marimba clairsemée
for bar, ch in enumerate(['Dm', 'Bb']):
    music.add(pad([note(n) for n in CH[ch]], 2.3), bar * 2, 0.55)
for at, n in [(0.5, 'A4'), (1.0, 'C5'), (1.5, 'D5'), (2.5, 'F5'), (3.0, 'D5'), (3.5, 'E5')]:
    music.add(marimba(note(n)), at, 0.28, pan=0.2)

# tension (4-8) : trop de lignes, hi-hat en doubles croches qui monte
for bar, ch in enumerate(['Gm', 'Bb', 'Csus', 'Csus']):
    music.add(pad([note(n) for n in CH[ch]], 1.2), 4 + bar * 1.0, 0.45)
for i in range(32):
    at = 4 + i * 0.125
    drums.add(shaker(0.05, 8000), at, 0.10 + 0.25 * i / 32, pan=0.4 if i % 2 else -0.4)
for i in range(8):
    drums.add(kick(0.2), 4 + i * 0.5, 0.35 + 0.05 * i)
# pops chaotiques des numéros de lignes
for i in range(26):
    sfx.add(pop(500 + rng.random() * 900, 0.1), 4.15 + rng.random() * 1.4, 0.05, pan=rng.uniform(-0.8, 0.8))
sfx.add(riser(1.5), 6.5, 0.22)

# logo (8-12) : impact + résolution en fa majeur
sfx.add(impact(), 8.0, 0.7)
music.add(pad([note(n) for n in ['F3', 'A3', 'C4', 'F4']], 4.4, att=0.05, rel=1.2), 8.0, 0.6)
for at, n in [(8.55, 'C5'), (8.85, 'F5'), (9.05, 'A5')]:  # anneau, barre, point
    music.add(marimba(note(n), 1.4), at, 0.4)
for i, n in enumerate(['F4', 'A4', 'C5', 'F5', 'C5', 'A4']):
    music.add(marimba(note(n)), 10.0 + i * 0.25, 0.22, pan=-0.3 + 0.12 * i)
sfx.add(riser(0.9), 11.1, 0.15)
sfx.add(pop(300, 0.4), 11.55, 0.25)  # le point orange s'agrandit

# groove (12-27.5) : I-V-vi-IV
prog = ['F', 'C', 'Dm', 'Bb']
melody = [  # (temps dans la mesure, note) sur 2 mesures, rejoué
    (0, 'C5'), (0.75, 'A4'), (1.5, 'C5'), (2.0, 'D5'), (2.75, 'C5'),
    (4, 'A4'), (4.75, 'G4'), (5.5, 'A4'), (6.0, 'C5'), (7.0, 'F5'),
]
start = 12.0
bars = 8  # 12 -> 28
for b in range(bars):
    t0 = start + b * 2
    ch = prog[b % 4]
    lim = min(2.0, 27.5 - t0)  # la dernière mesure s'arrête sur l'appel à l'action
    if lim <= 0:
        continue
    music.add(pad([note(n) for n in CH[ch]], min(2.2, lim + 0.15), att=0.2, rel=0.3), t0, 0.35)
    r = note(ROOT[ch])
    for at, mult in [(0, 1), (0.75, 1), (1.5, 2), (2.5, 1), (3.0, 1.5)]:  # basse syncopée
        if at * BEAT < lim:
            music.add(bass(r * mult, 0.4), t0 + at * BEAT, 0.42)
    for k in range(4):
        if k * BEAT < lim:
            drums.add(kick(), t0 + k * BEAT, 0.55 if k % 2 == 0 else 0.4)
    for k in (1, 3):
        if k * BEAT < lim:
            drums.add(clap(), t0 + k * BEAT, 0.18)
    for k in range(8):
        if k * BEAT / 2 < lim:
            drums.add(shaker(), t0 + k * BEAT / 2 + 0.25 * BEAT * (k % 2), 0.12 if k % 2 else 0.2, pan=0.35)
    if b >= 1:  # la mélodie entre après une mesure
        for at, n in melody:
            ta = start + (b // 2) * 4 + at * BEAT
            if b % 2 == 0 and at < 4 or b % 2 == 1 and at >= 4:
                if t0 <= ta < t0 + lim:
                    music.add(marimba(note(n)), ta, 0.3, pan=0.15)
    if b >= 5:  # couche en plus pour les avantages
        for k in range(4):
            if (k + 0.5) * BEAT < lim:
                music.add(marimba(note(CH[ch][k % 3]) * 2, 0.4), t0 + (k + 0.5) * BEAT, 0.12, pan=-0.4)

# sons de l'interface (démo)
for at in (13.3, 15.3, 16.95, 17.55):
    sfx.add(click(), at, 0.35)
for i in range(13):  # frappe au clavier
    sfx.add(click(3800 + rng.random() * 600, 0.025), 15.55 + i / 13, 0.12)
sfx.add(pop(900), 14.1, 0.2)  # position trouvée
for i in range(4):  # coches des avantages
    sfx.add(pop(800 + i * 120, 0.15), 23.35 + 0.55 + i * 0.3, 0.18)
sfx.add(pop(600), 18.75, 0.25)
sfx.add(pop(750), 18.9, 0.2)

# appel à l'action (27.5-31.5) : impact doux, accord final, fin sur la tonique
sfx.add(riser(1.0), 26.5, 0.14)
sfx.add(impact(3.5), 27.5, 0.45)
for b, ch in enumerate(['Bb', 'C']):
    music.add(pad([note(n) for n in CH[ch]], 1.1), 27.5 + b * 1.0, 0.65)
music.add(pad([note(n) for n in ['F3', 'A3', 'C4', 'F4']], 2.6, att=0.1, rel=1.6), 29.0, 0.75)
music.add(bass(note('F1'), 2.0), 29.0, 0.4)
for i, n in enumerate(['C5', 'F5', 'A5', 'C6']):
    music.add(marimba(note(n), 1.6), 28.6 + i * 0.12, 0.25, pan=-0.3 + 0.2 * i)
drums.add(kick(), 27.5, 0.6)
drums.add(kick(), 29.0, 0.5)

# ---------- mixage ----------
L = reverb(music.l, mix=0.3) + drums.l + reverb(sfx.l, 1.0, 0.15)
R = reverb(music.r, mix=0.3) + drums.r + reverb(sfx.r, 1.0, 0.15)
t = np.arange(N) / SR
fade = np.minimum(1, t / 0.05) * np.minimum(1, (DUR - t) / 1.2)
L, R = L * fade, R * fade
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = np.tanh(L / peak * 1.3) * 0.89, np.tanh(R / peak * 1.3) * 0.89
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('music.wav prêt')
