"""Musique de la vidéo « correspondances », synthétisée de zéro (libre de droits).

120 BPM : une mesure = 2 s, les changements de scène tombent sur les mesures (voir T dans scene.template.html).
Le problème (0-11,85 s) reste en tension, sans grosse caisse pleine ; la solution arrive sur un « drop »
(révélation orange, 11,85 s), puis le groove porte la démo ; second drop sur l'appel à l'action (31,4 s).

    python3 music.py            # écrit music.wav
"""
import numpy as np
import wave

SR = 44100
DUR = 36.5
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


def kick2(d=0.45):
    """Grosse caisse « commerciale » : sub + attaque sèche."""
    t = tt(d)
    f = 48 + 140 * np.exp(-t * 35)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    clk = fft_filter(rng.standard_normal(len(t)), lo=2000) * np.exp(-t * 400) * 0.5
    return np.tanh(2.2 * (body + clk)) * np.minimum(1, t / 0.0008)


def snare(d=0.3):
    t = tt(d)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    n = fft_filter(rng.standard_normal(len(t)), lo=1200, hi=9000) * np.exp(-t * 16)
    return (0.6 * tone + n) * np.minimum(1, t / 0.001)


def ohat(d=0.25):
    t = tt(d)
    return fft_filter(rng.standard_normal(len(t)), lo=7000) * np.exp(-t * 14)


def crash(d=2.5):
    t = tt(d)
    n = fft_filter(rng.standard_normal(len(t)), lo=3500)
    return n * np.exp(-t * 1.6) * np.minimum(1, t / 0.002)


def subdrop(d=1.6):
    t = tt(d)
    f = 30 + 50 * np.exp(-t * 2.5)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)


def stab(freqs, d=0.22, bright=5200):
    """Accord court et brillant (scie désaccordée), type piano house."""
    t = tt(d)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.15, 0.0, 0.14):
            ff = f * 2 ** (det / 12)
            for k in range(1, 9):
                s += np.sin(2 * np.pi * ff * k * t) / k
    env = np.exp(-t * 11) * np.minimum(1, t / 0.003) * np.minimum(1, (d - t) / 0.02)
    return fft_filter(s * env, hi=bright) / (len(freqs) * 4)


# ---------- partition ----------
CH = {
    'F': ['F3', 'A3', 'C4'], 'C': ['E3', 'G3', 'C4'], 'Dm': ['D3', 'F3', 'A3'],
    'Bb': ['D3', 'F3', 'Bb3'], 'Csus': ['F3', 'G3', 'C4'], 'Gm': ['D3', 'G3', 'Bb3'],
}
ROOT = {'F': 'F1', 'C': 'C2', 'Dm': 'D2', 'Bb': 'Bb1', 'Csus': 'C2', 'Gm': 'G1'}

drums, music, sfx = Bus(), Bus(), Bus()
kicks = []


def K(at, g=0.7):
    drums.add(kick2(), at, g)
    kicks.append(at)


def chord(name, up=False):
    fs = [note(n) for n in CH[name]]
    return [f * 2 for f in fs] if up else fs


# temps des scènes (identiques à T dans scene.template.html)
WIPE, DEMO, BEN, CTA = 11.85, 14.9, 26.8, 31.4
MAP, ASK = 3.65, 7.7

# problème (0-WIPE) : tension, battement de cœur, accords mineurs suspendus
for bar, ch in enumerate(['Dm', 'Bb', 'Gm', 'Dm', 'Bb']):
    music.add(pad(chord(ch), 2.3), bar * 2, 0.5)
    for k in (0, 2):
        K(bar * 2 + k * BEAT, 0.45 + 0.03 * bar)
    music.add(bass(note(ROOT[ch]), 0.9), bar * 2, 0.42)
music.add(pad(chord('Csus'), WIPE - 10.0 + 0.1), 10.0, 0.5)
for at, n in [(0.6, 'A4'), (1.1, 'C5'), (1.6, 'D5'), (2.5, 'E5')]:  # la question
    music.add(marimba(note(n)), at, 0.22, pan=0.2)
for i in range(int((WIPE - 0.6 - MAP) / 0.375)):  # tic-tac : on perd du temps
    drums.add(shaker(0.04, 9000), MAP + i * 0.375, 0.07 + 0.08 * i / 22, pan=0.4 if i % 2 else -0.4)
for i in range(3):  # chaque ligne s'arrête en route : petit « buzz » grave
    sfx.add(pop(220 - 20 * i, 0.32), MAP + 0.35 + i * 0.5 + 0.5, 0.32)
for i in range(5):  # bulles de conseils
    sfx.add(pop(650 + 90 * i, 0.12), ASK + 0.3 + i * 0.32, 0.2, pan=-0.4 + 0.2 * i)
roll = [WIPE - 1.25 + i * 0.125 for i in range(4)] + [WIPE - 0.75 + i * 0.0625 for i in range(8)]
for i, at in enumerate(roll):
    drums.add(snare(0.12), at, 0.1 + 0.32 * i / len(roll))
sfx.add(riser(1.3), WIPE - 1.45, 0.3)
# (WIPE-0.2 → WIPE : silence avant le drop)

# solution (WIPE) : DROP
sfx.add(impact(), WIPE, 0.75)
drums.add(crash(3.0), WIPE, 0.22)
music.add(subdrop(1.8), WIPE, 0.65)
K(WIPE, 0.9)
music.add(stab([note(n) for n in ['F3', 'A3', 'C4', 'F4']], 0.5), WIPE, 0.8)
music.add(pad([note(n) for n in ['F3', 'A3', 'C4', 'F4']], DEMO - WIPE + 0.2, att=0.05, rel=0.8), WIPE, 0.45)
for i, n in enumerate(['C5', 'F5', 'A5']):
    music.add(marimba(note(n), 1.2), WIPE + 0.42 + i * 0.13, 0.35)
for at in (WIPE + 1.0, WIPE + 2.0):
    K(at, 0.65)
    drums.add(snare(), at + 0.5, 0.28)

# démo et atouts (DEMO-CTA) : I-V-vi-IV, basse syncopée, stabs à contretemps
prog = ['F', 'C', 'Dm', 'Bb']
melody = [(0, 'C5'), (0.75, 'A4'), (1.5, 'C5'), (2.0, 'D5'), (2.75, 'C5'),
          (4, 'A4'), (4.75, 'G4'), (5.5, 'A4'), (6.0, 'C5'), (7.0, 'F5')]
start, stop = DEMO, CTA
for b in range(int((stop - start) / 2) + 1):
    t0 = start + b * 2
    ch = prog[b % 4]
    lim = min(2.0, stop - t0)
    if lim <= 0:
        continue
    music.add(pad(chord(ch), min(2.2, lim + 0.15), att=0.2, rel=0.3), t0, 0.28)
    r = note(ROOT[ch])
    for at, mult in [(0, 1), (0.75, 1), (1.5, 2), (2.5, 1), (3.0, 1.5), (3.5, 2)]:
        if at * BEAT < lim:
            music.add(bass(r * mult, 0.35), t0 + at * BEAT, 0.5)
    for k in range(4):
        if k * BEAT < lim:
            K(t0 + k * BEAT, 0.72)
            drums.add(ohat(), t0 + (k + 0.5) * BEAT, 0.1, pan=-0.3)
            music.add(stab(chord(ch, True), 0.16), t0 + (k + 0.5) * BEAT, 0.26, pan=0.2)
    for k in (1, 3):
        if k * BEAT < lim:
            drums.add(clap(), t0 + k * BEAT, 0.24)
    for k in range(8):
        if k * BEAT / 2 < lim:
            drums.add(shaker(), t0 + k * BEAT / 2, 0.08 if k % 2 else 0.12, pan=0.35)
    if b >= 1:
        for at, n in melody:
            ta = start + (b // 2) * 4 + at * BEAT
            if (b % 2 == 0 and at < 4 or b % 2 == 1 and at >= 4) and t0 <= ta < t0 + lim:
                music.add(marimba(note(n)), ta, 0.26, pan=0.15)
    if t0 >= BEN:  # couche en plus pour les atouts
        for k in range(8):
            if k * BEAT / 2 < lim:
                music.add(marimba(note(CH[ch][k % 3]) * 2, 0.3), t0 + k * BEAT / 2, 0.09, pan=-0.4)
drums.add(crash(2.0), DEMO, 0.14)
drums.add(crash(1.8), BEN, 0.13)

# sons de l'interface (mêmes temps que la scène)
for i in range(18):  # frappe « Petro Ivoire Angré »
    sfx.add(click(3800 + rng.random() * 600, 0.025), 15.4 + i / 26, 0.1)
for i in range(22):  # frappe « Terminus Gonzagueville »
    sfx.add(click(3800 + rng.random() * 600, 0.025), 16.15 + i / 26, 0.1)
for at in (17.2, 20.95):  # taps
    sfx.add(click(), at, 0.32)
sfx.add(pop(900), 17.85, 0.2)  # la combinaison arrive
for i, at in enumerate((21.8, 22.75, 23.7)):  # repères de la carte
    sfx.add(pop(700 + 120 * i, 0.15), at, 0.18)
for i in range(4):  # coches des atouts
    sfx.add(pop(800 + i * 120, 0.15), BEN + 0.8 + i * 0.75, 0.18)

# appel à l'action (CTA) : second drop, accord final sur la tonique
for i, at in enumerate([CTA - 1.0 + i * 0.125 for i in range(8)]):
    drums.add(snare(0.12), at, 0.12 + 0.04 * i)
sfx.add(riser(1.0), CTA - 1.0, 0.22)
sfx.add(impact(3.5), CTA, 0.6)
drums.add(crash(3.0), CTA, 0.22)
music.add(subdrop(1.8), CTA, 0.6)
K(CTA, 0.9)
music.add(stab(chord('Bb', True), 0.4), CTA, 0.6)
music.add(stab(chord('C', True), 0.4), CTA + 0.75, 0.55)
K(CTA + 0.75, 0.7)
music.add(pad([note(n) for n in ['F3', 'A3', 'C4', 'F4']], DUR - CTA - 1.5, att=0.05, rel=2.0), CTA + 1.5, 0.7)
music.add(stab([note(n) for n in ['F3', 'A3', 'C4', 'F4']], 0.6), CTA + 1.5, 0.7)
music.add(bass(note('F1'), 2.2), CTA + 1.5, 0.5)
for i, n in enumerate(['C5', 'F5', 'A5', 'C6']):
    music.add(marimba(note(n), 1.6), CTA + 1.1 + i * 0.12, 0.25, pan=-0.3 + 0.2 * i)
K(CTA + 1.5, 0.8)
drums.add(crash(2.4), CTA + 1.5, 0.15)
for at in (CTA + 2.5, CTA + 3.0, CTA + 3.5):  # pulsation légère jusqu'à la fin
    K(at, 0.35)

# ---------- mixage ----------
t = np.arange(N) / SR
pump = np.ones(N)
for k in kicks:
    i = int(k * SR)
    pump[i:] = np.minimum(pump[i:], 1 - 0.5 * np.exp(-t[: N - i] / 0.11))
music.l *= pump
music.r *= pump
L = reverb(music.l, mix=0.25) + drums.l + reverb(sfx.l, 1.0, 0.15)
R = reverb(music.r, mix=0.25) + drums.r + reverb(sfx.r, 1.0, 0.15)
gap = 1 - 0.97 * ((t > WIPE - 0.2) & (t < WIPE))  # coupure avant le drop
L, R = L * gap, R * gap
fade = np.minimum(1, t / 0.05) * np.minimum(1, (DUR - t) / 1.5)
L, R = L * fade, R * fade
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = np.tanh(L / peak * 1.6) * 0.9, np.tanh(R / peak * 1.6) * 0.9
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('music.wav prêt')
