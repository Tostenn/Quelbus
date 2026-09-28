# Front de QuelBus

Landing page et page contact de [QuelBus](../README.md), en React + TypeScript + Vite.

```sh
npm install
cp .env.example .env   # VITE_API_URL pointe vers l'API Laravel (back/)
npm run dev            # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification TypeScript et build de production dans `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Sert le build de production |

Structure : `src/pages/` (Accueil, Contact), `src/components/` (mise en page, logo, badge de ligne), `src/lib/` (configuration et appel à l'API). Les couleurs et typographies de la maquette sont définies en variables CSS en tête de `src/index.css`.

Voir le [guide de contribution](../CONTRIBUTING.md).
