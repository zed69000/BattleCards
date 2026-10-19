# Apps Android et iOS

Le jeu web de `public/` est emballé en app native avec [Capacitor](https://capacitorjs.com) 8.
Les projets natifs `android/` et `ios/` ne sont pas dans le dépôt : Codemagic les régénère à chaque build
(`npm run android` / `npm run ios`), avec les icônes et l'écran de démarrage tirés de `assets/`.

- **Identifiant de l'app** : `com.musclorduck.battlecards` (dans `capacitor.config.json` et `codemagic.yaml`).
  À changer *avant* la première publication si besoin : il est définitif sur les stores ensuite.
- **Nom affiché** : « Bataille des Alliés ».
- **Version** : celle du jeu (`window.BDA_V` dans `cosmos.html`) ; numéro de build : celui de Codemagic.
- **Icônes** : `python tools/make_icons.py` régénère `public/icon-*.png` et `assets/` (icône 1024 px, écran de démarrage).

Le site web (Cloudflare) n'est pas touché : il publie toujours `public/` tel quel.

## Les 3 builds Codemagic

| Workflow | Produit | Ce qu'il faut avant |
|---|---|---|
| **Android · APK de test** | un `.apk` à installer sur un téléphone | rien |
| **Android · Google Play (AAB signé)** | un `.aab` à envoyer sur Google Play | une clé d'envoi |
| **iOS · TestFlight** | une app envoyée sur TestFlight | compte Apple Developer, clé API App Store Connect, certificat |

Dans Codemagic, ouvrir l'app BattleCards et cliquer **Check for configuration files** : les 3 workflows apparaissent.
Les builds se lancent à la main (**Start new build**, choisir le workflow et la branche `main`).

## 1. Android · APK de test

1. Lancer le workflow **Android · APK de test**.
2. Télécharger l'`.apk` dans les artefacts du build.
3. Sur le téléphone : ouvrir le fichier, autoriser l'installation d'applications inconnues pour le navigateur ou
   le gestionnaire de fichiers, installer. Ou, téléphone branché en USB : `adb install app-debug.apk`.

## 2. Android · Google Play

1. **Compte Google Play Console** (25 $, une fois), puis créer l'app avec l'identifiant `com.musclorduck.battlecards`.
2. **Clé d'envoi** : dans Codemagic, *Team settings → Code signing identities → Android keystores*, ajouter un
   keystore (en générer un avec la commande ci-dessous ou celui fourni par Codemagic) avec la référence
   **`battlecards_upload_key`**. Garder une copie du fichier et des mots de passe en lieu sûr : sans elle, plus de mise à jour.

   ```
   keytool -genkey -v -keystore battlecards-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
3. Lancer **Android · Google Play (AAB signé)**, télécharger l'`.aab` et le déposer la première fois à la main dans
   Play Console (piste *Tests internes*), en activant la signature d'application par Google Play.
4. Ensuite, envoi automatique : créer un compte de service Google Cloud avec accès à Play Console, mettre son JSON dans
   une variable d'environnement Codemagic `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` (groupe secret), et décommenter
   le bloc `publishing` du workflow dans `codemagic.yaml`.

## 3. iOS · TestFlight

1. **Compte Apple Developer** (99 $ par an).
2. Dans [App Store Connect](https://appstoreconnect.apple.com) : créer l'identifiant `com.musclorduck.battlecards`
   (*Certificates, Identifiers & Profiles*), puis l'app.
3. **Clé API App Store Connect** (*Utilisateurs et accès → Intégrations → Clés*, rôle *App Manager*) : l'ajouter dans
   Codemagic, *Team settings → Integrations → Developer Portal*, sous le nom **`BattleCards ASC`**.
4. **Signature** : dans Codemagic, *Code signing identities*, générer ou importer un certificat de distribution iOS,
   puis récupérer le profil *App Store* de `com.musclorduck.battlecards`.
5. Lancer **iOS · TestFlight** : l'app arrive dans TestFlight après le traitement d'Apple (quelques minutes à une heure).

## Avant de publier pour de vrai

- Fiches des stores : captures d'écran (téléphone), courte vidéo, description, mots-clés, catégorie Jeux › Cartes.
- Classement d'âge : viser 9+ ou 12+, sans cibler explicitement les enfants (règles plus strictes sur pubs et données).
- Confidentialité : fiche *Data safety* (Google Play) et étiquettes de confidentialité (App Store). Aujourd'hui le jeu ne
  collecte rien : sauvegarde locale, duels en pair à pair.
- Boosters : s'ils deviennent achetables avec de l'argent réel (même via des cristaux achetés), afficher les
  probabilités (commune 70 %, rare 25 %, légendaire 5 %).
- Duels entre amis : ils passent par le service public gratuit de PeerJS. Pour une app publiée, prévoir un serveur
  de mise en relation à soi.
