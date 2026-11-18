# Passerelle locale TaskFlow

Service Express qui tourne sur le PC local, à côté de PostgreSQL. C'est le seul process autorisé à ouvrir la base. Render l'atteint via un tunnel HTTPS. Le port applicatif reste lié à `127.0.0.1`.

Le JWT des utilisateurs n'est pas vérifié ici. Render l'a déjà vérifié et n'envoie que l'identifiant de l'utilisateur concerné. La passerelle contrôle un second secret, `LOCAL_GATEWAY_TOKEN`, dans l'en-tête `x-local-gateway-token` (l'ancien en-tête `x-gateway-secret` est encore accepté).

Il n'y a pas de route qui exécute du SQL reçu du client. Les requêtes sont fixes et paramétrées. Toutes les lectures et écritures de tâches filtrent sur `user_id`.

## Routes internes

Toutes exigent le secret, sauf `GET /` qui confirme seulement que le process répond.

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/` | Présence du process, sans donnée |
| `GET` | `/api/internal/health` | `200` si PostgreSQL répond, `503` sinon |
| `POST` | `/api/internal/users/by-email` | Utilisateur, y compris `password_hash`, ou `null` |
| `GET` | `/api/internal/users/:id` | Profil sans empreinte |
| `POST` | `/api/internal/users` | Crée un compte déjà haché par Render |
| `GET` | `/api/internal/tasks?userId=` | Tâches de cet utilisateur |
| `GET` | `/api/internal/tasks/stats?userId=` | Compteurs du tableau de bord |
| `POST` | `/api/internal/tasks` | Création |
| `PUT` | `/api/internal/tasks/:id` | Mise à jour, `userId` dans le corps |
| `DELETE` | `/api/internal/tasks/:id?userId=` | `{ success: true/false }` |

Une ressource absente est renvoyée en `200` avec `null` ou `success: false`. C'est le contrat déjà consommé par le backend. L'API publique, elle, traduit ça en `404`.

## Installation sur le PC local

PostgreSQL doit déjà écouter sur `127.0.0.1`. Ne pas ouvrir le port 5432 sur la box ou le partage de connexion.

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\local-gateway
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run dev
```

Renseigner dans `.env` le mot de passe choisi pour `taskflow_app` et un `LOCAL_GATEWAY_TOKEN` long. La même valeur va dans les variables Render, sous le même nom.

Générer le secret :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Production locale, après compilation :

```powershell
npm run build
npm start
```

Le process s'arrête immédiatement si `LOCAL_GATEWAY_TOKEN` est vide.

## Tunnel

Dans un second terminal, une fois la passerelle démarrée :

```powershell
cloudflared tunnel --url http://127.0.0.1:4000
```

Si `cloudflared` n'est pas installé :

```powershell
winget install --id Cloudflare.cloudflared
```

Copier l'URL `https://....trycloudflare.com` dans `LOCAL_GATEWAY_URL` sur Render. Cette URL change à chaque Quick Tunnel.

Cloudflare n'est pas intégré au code. Couper le tunnel, ou arrêter cette passerelle, rend les données indisponibles côté Vercel (`503`) sans arrêter Render. Relancer le tunnel et mettre à jour l'URL les rétablit. Les lignes restent dans PostgreSQL.

## Limites

- Écoute par défaut sur `127.0.0.1` uniquement.
- Corps JSON plafonné à 32 Ko.
- 300 requêtes par minute et par adresse source. Derrière `cloudflared`, cette adresse est `127.0.0.1`, donc la limite est globale au tunnel.
- Pas de CORS : un navigateur ne peut pas appeler cette API.
- Les journaux contiennent la méthode, le chemin et le statut. Ils ne contiennent ni mot de passe, ni empreinte, ni secret.

## Tests

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\local-gateway
npm test
```

Ces tests couvrent le refus sans secret et avec un mauvais secret. Ils ne démarrent pas PostgreSQL. Le parcours jusqu'à la base est lancé depuis `backend` avec `npm run test:integration`.

## Dépannage

| Symptôme | Piste |
|---|---|
| La passerelle quitte tout de suite | `LOCAL_GATEWAY_TOKEN` vide |
| Health en 503 | Mauvais `DB_*`, PostgreSQL arrêté, ou migrations non appliquées |
| Render reçoit 401 puis le site affiche 503 | Les deux secrets ne sont pas identiques |
| `ECONNREFUSED 127.0.0.1:5432` | Le service PostgreSQL local est arrêté |
| Le tunnel répond mais Render ne voit rien | `LOCAL_GATEWAY_URL` pointe encore vers un ancien tunnel |
