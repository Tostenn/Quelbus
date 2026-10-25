# Vidéo de présentation QuelBus

Animation de 31 secondes en motion design, sans son. Toute l'animation est codée en HTML/CSS/JS dans `scene.template.html`, puis rendue image par image avec Playwright et encodée avec ffmpeg. Le résultat est identique à chaque rendu.

## Déroulé

| Temps | Scène |
|---|---|
| 0 – 4 s | Accroche : « Pour aller à Adjamé depuis Angré… je prends quel bus ? » |
| 4 – 8 s | Le problème : une avalanche de numéros de lignes |
| 8 – 12 s | Les lignes sont aspirées et forment le logo, puis le slogan apparaît |
| 12 – 23 s | Démo sur téléphone : départ, destination, résultat |
| 23 – 27,5 s | Avantages : SOTRA, gbakas, wôrô-wôrôs, bon sens, partage, 3G |
| 27,5 – 31,5 s | Appel à l'action : quelbus.monradar.ci |

Le résultat de la démo (ligne 81, arrêts) est **illustratif**. Remplacez-le par un vrai résultat dans `scene.template.html` (bloc `#results`).

## Mouvement

L'animation suit le skill `motion-design` (`.claude/skills/motion-design`) :

- personnalité Playful maîtrisée ;
- easing signature expoOut pour les entrées, expoIn pour les sorties, backOut léger pour les « pops » ;
- trois couches : action principale, détails secondaires (ombres, coches, doigt) et fond animé (tracés de lignes qui défilent).

## Générer les vidéos

Prérequis : Node avec Playwright et Chromium, Python 3, ffmpeg.

```sh
cd video
python3 build.py                                   # gabarit + logo → scene.html
node render.js 1080 1920 quelbus-vertical.mp4      # 9:16 : TikTok, Reels, Shorts, Statut WhatsApp
node render.js 1920 1080 quelbus-horizontal.mp4    # 16:9 : site, YouTube, LinkedIn
```

Pour vérifier une image précise sans tout rendre, par exemple aux secondes 3,6 et 21 :

```sh
mkdir -p stills && node stills.js 1080 1920 3.6 21
```

Polices : Archivo et IBM Plex Mono (licence SIL Open Font), incluses dans `fonts/`.
