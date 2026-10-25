# Voix off QuelBus (ElevenLabs)

8 phrases courtes, une par scène. Générez **chaque phrase dans un fichier séparé** et nommez-les `01.mp3` à `08.mp3`. Chaque phrase est alors posée exactement sur sa scène, sans souci de rythme entre elles.

La colonne « À coller » est le texte à donner à ElevenLabs : certains mots y sont écrits comme ils se prononcent.

| Fichier | Moment | Durée max | À l'écran | À coller dans ElevenLabs |
|---|---|---|---|---|
| `01` | 0,3 s | 3,6 s | Accroche | Pour aller à Adjamé depuis Angré… je prends quel bus ? |
| `02` | 4,4 s | 3,5 s | Les numéros de lignes | Des centaines de lignes… et aucune réponse simple. |
| `03` | 9,3 s | 2,9 s | Logo + slogan | QuelBus. Quel bus prendre ? On vous le dit. |
| `04` | 12,7 s | 2,2 s | Étape 1 | Indiquez où vous êtes… |
| `05` | 15,2 s | 3,0 s | Étape 2 | …puis où vous allez. Un lieu connu suffit. |
| `06` | 18,4 s | 4,8 s | Étape 3, résultats | Et voilà vos lignes directes : où monter, où descendre, et combien marcher. |
| `07` | 23,6 s | 3,8 s | Avantages | Sotra, gbaka, woro-woro… Gratuit, et fait à Abidjan. |
| `08` | 28,0 s | 3,2 s | Appel à l'action | Essayez-le maintenant, sur quelbus point C I. |

Une phrase un peu trop longue est accélérée automatiquement, de 10 % au plus. Au-delà, régénérez-la avec un débit plus rapide.

## Réglages conseillés

- **Voix** : française, chaleureuse, ton souriant et complice, pas « pub radio ». Dans la Voice Library, cherchez « Ivorian » ou « African French » pour un accent d'ici, c'est plus crédible pour Abidjan.
- **Modèle** : Eleven Multilingual v2, ou Eleven v3 si disponible.
- **Stability** autour de 45 %, **Similarity** 75 %, **Style** 20–30 %, **Speed** 1,0 à 1,1.
- **Export** : MP3 44,1 kHz (ou WAV).

## Assembler

Déposez les fichiers dans `video/voix/`, puis :

```sh
cd video
python3 mix.py
```

Les vidéos finales (image + musique + voix) sont écrites dans `front/public/video/`.
