# Bataille des Alliés — Conquête de l'espace

Prototype web d'un jeu de cartes dérivé de la bataille, jouable sur mobile et sur ordinateur.

Tout le site est dans le dossier `public/`.

- **Le jeu** : `cosmos.html` (la page d'accueil `index.html` y redirige), avec `casts.js` pour les illustrations.
- **Planches de direction artistique** : `da.html`, `da2.html`, `da3.html`, `da4.html`.
- **Premier prototype** : `prototype-v1.html`.

Aucune installation : ce sont des fichiers statiques. Pour tester en local, servir le dossier
(`python -m http.server --directory public`) puis ouvrir `http://localhost:8000`.

Le dépôt se déploie sans réglage sur Netlify (`netlify.toml`) ou sur Cloudflare (`wrangler.jsonc`).
