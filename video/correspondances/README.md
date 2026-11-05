# Vidéo TikTok : les correspondances

29 secondes, 1080×1920, avec musique (composée en code, libre de droits) et voix off ElevenLabs (voir `voix-off.md`). Toute l'animation est codée dans `scene.template.html`, puis rendue image par image avec Playwright et encodée avec ffmpeg : le résultat est identique à chaque rendu.

| Temps | Scène |
|---|---|
| 0 – 3 s | Le problème : « Angré → Gonzagueville… Je prends quel bus ? » |
| 3 – 6 s | Trois lignes partent d'Angré et s'arrêtent en route : « Aucun bus ne fait tout le trajet. » |
| 6 – 9 s | « On demande à tout le monde… » : des conseils qui se contredisent |
| 9 – 11 s | La solution : « Nouveau sur QuelBus : les correspondances » |
| 11 – 20 s | Démo : saisie, combinaison 775 → 53, page trajet qui se dessine |
| 20 – 24,5 s | Atouts : bus SOTRA d'abord, grandes gares, peu de marche, suivi |
| 24,5 – 29 s | Appel à l'action : quelbus.ci |

Le trajet montré est un vrai résultat de QuelBus : Petro Ivoire Angré → 775 jusqu'à Pont Lycée Technique → 53 jusqu'au Terminus Gonzagueville (38 arrêts, 107 m à pied). Pour en montrer un autre, modifiez l'accroche (`#trip`), les écrans 1 à 3 (`#sA`, `#sB`, `#sC`) et la frappe au clavier dans `music.py`, et la voix off (`voix-off.md`).

## Générer

Prérequis : Node avec Playwright et Chromium, Python 3 avec numpy, ffmpeg.

```sh
cd video/correspondances
python3 build.py                          # gabarit + logos → scene.html
mkdir -p out stills
node stills.js 2.8 9.6 13.8               # (facultatif) images fixes pour vérifier une scène
node render.js out/video-muet.mp4         # image
python3 music.py                          # musique → music.wav
python3 mix.py                            # image + musique + voix (voix/01.mp3…09.mp3) → out/quelbus-correspondances-tiktok.mp4
```

Polices : Archivo et IBM Plex Mono (licence SIL Open Font), dans `video/fonts/`.
