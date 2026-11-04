# Vidéo TikTok : les correspondances

24 secondes, 1080×1920, avec musique (composée en code, libre de droits). Toute l'animation est codée dans `scene.template.html`, puis rendue image par image avec Playwright et encodée avec ffmpeg : le résultat est identique à chaque rendu.

| Temps | Scène |
|---|---|
| 0 – 4 s | Accroche : « Yopougon → Cocody · Pas de bus direct ? » |
| 4 – 6 s | Révélation : « Nouveau sur QuelBus : les correspondances » |
| 6 – 15 s | Démo : saisie, combinaison proposée, page trajet qui se dessine |
| 15 – 19,5 s | Atouts : bus SOTRA d'abord, grandes gares, peu de marche, suivi |
| 19,5 – 24 s | Appel à l'action : quelbus.ci |

Le trajet montré (Yopougon → Adjamé → Cocody) est un exemple, sans numéros de ligne. Pour montrer un vrai résultat, modifiez les écrans 2 et 3 dans `scene.template.html` (blocs `#sB` et `#sC`).

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
