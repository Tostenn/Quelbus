"""Assemble la vidéo finale : image + musique + voix off.

Les phrases de la voix off (voix/01.mp3 … voix/08.mp3, ou .wav) sont posées
chacune à son moment (voir CUES et voix-off.md). Une phrase trop longue pour
son créneau est légèrement accélérée (10 % au plus). La musique baisse
automatiquement quand la voix parle.

    python3 mix.py                 # musique seule si voix/ est vide
"""
import json
import pathlib
import subprocess

here = pathlib.Path(__file__).parent
OUT = here.parent / 'front/public/video'

# (début en secondes, fin à ne pas dépasser) pour chaque phrase
CUES = [
    (0.3, 3.95),    # 01 accroche
    (4.4, 7.9),     # 02 le problème
    (9.3, 12.2),    # 03 logo + slogan
    (12.7, 14.9),   # 04 étape 1
    (15.2, 18.2),   # 05 étape 2
    (18.4, 23.2),   # 06 étape 3
    (23.6, 27.4),   # 07 avantages
    (28.0, 31.2),   # 08 appel à l'action
]

VIDEOS = [
    ('out/vertical-muet.mp4', 'quelbus-presentation-vertical.mp4'),
    ('out/horizontal-muet.mp4', 'quelbus-presentation.mp4'),
]


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)['format']['duration'])


def find_clip(i):
    for ext in ('wav', 'mp3', 'm4a'):
        p = here / 'voix' / f'{i:02d}.{ext}'
        if p.exists():
            return p
    return None


clips = []
for i, (start, end) in enumerate(CUES, 1):
    p = find_clip(i)
    if not p:
        continue
    d = duration(p)
    tempo = min(1.10, max(1.0, d / (end - start)))
    if d / tempo > end - start + 0.05:
        print(f'⚠ phrase {i:02d} : {d:.2f} s pour un créneau de {end - start:.2f} s, elle débordera un peu')
    clips.append((p, start, tempo))
    print(f'phrase {i:02d} : {d:.2f} s à {start:.2f} s' + (f' (accélérée ×{tempo:.2f})' if tempo > 1 else ''))

# entrée 0 = vidéo, 1 = musique, 2… = phrases
inputs = ['-i', str(here / 'music.wav')]
for p, _, _ in clips:
    inputs += ['-i', str(p)]

if clips:
    parts = []
    for k, (_, start, tempo) in enumerate(clips, 1):
        ms = int(start * 1000)
        # nettoyage léger de la voix : coupe les graves inutiles, compresse un peu
        parts.append(f'[{k + 1}:a]aresample=44100,aformat=channel_layouts=stereo,atempo={tempo:.4f},'
                     f'highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,'
                     f'adelay={ms}|{ms}[v{k}]')
    mixv = ''.join(f'[v{k}]' for k in range(1, len(clips) + 1))
    parts.append(f'{mixv}amix=inputs={len(clips)}:normalize=0,volume=1.6,asplit=2[voice][key]')
    # la musique baisse (environ -12 dB) quand la voix parle
    parts.append('[1:a]volume=0.55[mus]')
    parts.append('[mus][key]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=400[duck]')
    parts.append('[duck][voice]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]')
    graph = ';'.join(parts)
else:
    graph = '[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]'

OUT.mkdir(parents=True, exist_ok=True)
for src, dst in VIDEOS:
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(here / src), *inputs,
                    '-filter_complex', graph,
                    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-ar', '44100', '-shortest', '-movflags', '+faststart', str(OUT / dst)], check=True)
    print('✓', OUT / dst)
