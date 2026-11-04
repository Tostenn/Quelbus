# Vidéo TikTok : les correspondances

24 secondes, 1080×1920, avec musique (composée en code, libre de droits). Toute l'animation est codée dans `scene.template.html`, puis rendue image par image avec Playwright et encodée avec ffmpeg : le résultat est identique à chaque rendu.

| Temps | Scène |
|---|---|
| 0 – 4 s | Accroche : « Angré → Gonzagueville · Pas de bus direct ? » |
| 4 – 6 s | Révélation : « Nouveau sur QuelBus : les correspondances » |
| 6 – 15 s | Démo : saisie, combinaison proposée, page trajet qui se dessine |
| 15 – 19,5 s | Atouts : bus SOTRA d'abord, grandes gares, peu de marche, suivi |
| 19,5 – 24 s | Appel à l'action : quelbus.ci |

Le trajet montré est un vrai résultat de QuelBus : Petro Ivoire Angré → 775 jusqu'à Pont Lycée Technique → 53 jusqu'au Terminus Gonzagueville (38 arrêts, 107 m à pied). Pour en montrer un autre, modifiez l'accroche (`#trip`), les écrans 1 à 3 (`#sA`, `#sB`, `#sC`) et la frappe au clavier dans `music.py`.

## Générer

Prérequis : Node avec Playwright et Chromium, Python 3 avec numpy, ffmpeg.

```sh
cd video/correspondances
python3 build.py                          # gabarit + logos → scene.html
mkdir -p out stills
node stills.js 2.8 9.6 13.8               # (facultatif) images fixes pour vérifier une scène
node render.js out/video-muet.mp4         # image
python3 music.py                          # musique → music.wav
./mix.sh                                  # image + musique → out/quelbus-correspondances-tiktok.mp4
```

Polices : Archivo et IBM Plex Mono (licence SIL Open Font), dans `video/fonts/`.
