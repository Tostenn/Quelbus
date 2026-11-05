"""Assemble la vidéo finale : image + musique + voix off (voix/01.mp3 … voix/09.mp3).

Chaque phrase est posée à son moment (CUES). Les silences de début et de fin sont coupés ;
une phrase trop longue pour son créneau est accélérée de 20 % au plus. La musique baisse
sous la voix. Les phrases absentes sont simplement sautées.

    python3 mix.py        # → out/quelbus-correspondances-tiktok.mp4
"""
import json
import pathlib
import subprocess

here = pathlib.Path(__file__).parent

# (début, fin à ne pas dépasser) en secondes, une ligne par phrase de voix-off.md
CUES = [
    (0.15, 3.1),    # 01 accroche
    (3.2, 5.95),    # 02 aucun bus ne fait tout le trajet
    (6.05, 8.85),   # 03 chacun dit autre chose
    (9.3, 11.25),   # 04 révélation
    (11.3, 13.65),  # 05 saisie
    (13.7, 16.05),  # 06 résultat
    (16.1, 19.9),   # 07 page trajet
    (20.2, 24.35),  # 08 atouts
    (24.7, 28.7),   # 09 appel à l'action
]
SIL = 'start_periods=1:start_threshold=-45dB:start_silence=0.03'


def run(*args):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args], check=True)


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)['format']['duration'])


def clip(i):
    for ext in ('mp3', 'wav', 'm4a'):
        p = here / 'voix' / f'{i:02d}.{ext}'
        if p.exists() and p.stat().st_size > 0:
            return p
    return None


def prepare(src, i, slot):
    dst = here / 'out' / 'voix' / f'{i:02d}.wav'
    dst.parent.mkdir(parents=True, exist_ok=True)
    run('-i', str(src), '-af', f'silenceremove={SIL},areverse,silenceremove={SIL},areverse', '-ar', '48000', str(dst))
    d = duration(dst)
    if d > slot:
        speed = min(1.2, d / slot)
        fast = dst.with_name(f'{i:02d}-rapide.wav')
        run('-i', str(dst), '-af', f'atempo={speed:.3f}', str(fast))
        print(f'  phrase {i:02d} : {d:.2f} s pour {slot:.2f} s → accélérée ×{speed:.2f}'
              + (' (encore trop longue : régénérez-la plus rapide)' if d / speed > slot + 0.05 else ''))
        return fast
    return dst


inputs, parts = [], []
for i, (start, end) in enumerate(CUES, 1):
    src = clip(i)
    if not src:
        print(f'  phrase {i:02d} absente, sautée')
        continue
    path = prepare(src, i, end - start)
    inputs += ['-i', str(path)]
    n = len(parts) + 2  # 0 = vidéo, 1 = musique
    ms = int(start * 1000)
    parts.append(f'[{n}:a]adelay={ms}|{ms},volume=1.6[v{n}]')

out = here / 'out' / 'quelbus-correspondances-tiktok.mp4'
if parts:
    labels = ''.join(f'[v{k + 2}]' for k in range(len(parts)))
    graph = ';'.join(parts) + f';{labels}amix=inputs={len(parts)}:normalize=0,apad[voice];' \
        '[voice]asplit[vo][key];[1:a][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[bed];' \
        '[bed][vo]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=9[a]'
else:
    graph = '[1:a]loudnorm=I=-14:TP=-1.5:LRA=9[a]'
run('-i', str(here / 'out/video-muet.mp4'), '-i', str(here / 'music.wav'), *inputs,
    '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-ar', '48000', '-shortest', '-movflags', '+faststart', str(out))
print(f'{out.relative_to(here)} prêt ({len(parts)} phrase(s) de voix)')
