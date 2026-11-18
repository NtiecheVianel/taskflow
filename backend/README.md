# TaskFlow — Backend API

API Express + TypeScript déployée sur **Render**. Le frontend Next.js est sur **Vercel** et appelle déjà `https://taskflow-backend-k9wq.onrender.com`.

Render ne se connecte pas à PostgreSQL. Il appelle la passerelle du PC local à travers un tunnel HTTPS. PostgreSQL, la passerelle et `cloudflared` tournent sur cette même machine.

```text
Frontend Vercel
    → Backend Render
        → Cloudflare Quick Tunnel
            → local-gateway (PC local, 127.0.0.1:4000)
                → PostgreSQL (PC local, 127.0.0.1:5432)
```

Le JWT authentifie l'utilisateur de TaskFlow. `LOCAL_GATEWAY_TOKEN` authentifie Render auprès de la passerelle. Les deux secrets sont distincts. Aucun des deux n'est envoyé au navigateur en clair : le JWT est le jeton de session, le secret de passerelle reste sur Render.

## Routes publiques inchangées

| Méthode | Route | Accès |
|---|---|---|
| `POST` | `/api/auth/register` | Public. Corps : `full_name`, `email`, `password`. Réponse : `{ token, user }` sans `password_hash`. |
| `POST` | `/api/auth/login` | Public. Corps : `email`, `password`. |
| `GET` | `/api/auth/me` | Bearer JWT |
| `GET` | `/api/tasks` | Bearer JWT. Tableau des tâches de l'utilisateur. |
| `GET` | `/api/tasks/:id` | Bearer JWT |
| `POST` | `/api/tasks` | Bearer JWT. `title`, `description`, `status`, `priority`, `due_date`. |
| `PUT` | `/api/tasks/:id` | Bearer JWT |
| `DELETE` | `/api/tasks/:id` | Bearer JWT. Réponse `{ message }`. |
| `GET` | `/` | Vivacité du process. À utiliser comme health check Render. |
| `GET` | `/api/health` | État de la passerelle et de PostgreSQL. Renvoie 503 si le tunnel ou la base est coupé. |

Statuts : `À faire`, `En cours`, `Terminée`. Priorités : `Basse`, `Moyenne`, `Haute`.

## Démarrage local

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\backend
npm install
Copy-Item .env.example .env
npm run dev
```

Deux modes locaux :

- `LOCAL_GATEWAY_URL` renseigné : le backend parle à la passerelle, comme Render.
- sinon, avec `DB_*` renseigné : le backend parle à PostgreSQL. Utile pour développer sur la même machine que la base. Ce mode est **désactivé** dès que `NODE_ENV=production` ou que la variable `RENDER` est présente.

Le stockage en mémoire a été retiré. Sans passerelle et sans PostgreSQL, les routes de données répondent `503`.

## Variables Render

À définir dans le dashboard Render du service existant. Ne pas y mettre `DB_HOST`, `DB_PASSWORD` ni aucune chaîne PostgreSQL.

```text
NODE_ENV=production
JWT_SECRET=<secret long, différent de l'ancien défaut du code>
JWT_EXPIRES_IN=24h
LOCAL_GATEWAY_URL=https://xxxx.trycloudflare.com
LOCAL_GATEWAY_TOKEN=<le même secret que dans local-gateway/.env>
FRONTEND_URL=https://<projet>.vercel.app
```

`GATEWAY_URL` et `GATEWAY_SECRET` sont encore lus si les nouveaux noms sont absents.

`JWT_SECRET` est obligatoire. Sans lui, le process s'arrête. L'ancienne clé par défaut écrite dans le code n'est plus utilisée en production. Les comptes créés avec l'ancien mode mémoire ne survivent de toute façon pas à un redémarrage.

Le health check Render doit cibler `/`. `/api/health` passe à 503 quand le tunnel est coupé : Render redémarrerait alors le service en boucle.

Un Quick Tunnel Cloudflare change d'URL à chaque lancement de `cloudflared`. Il faut alors mettre à jour `LOCAL_GATEWAY_URL` sur Render.

## Migrations

Les migrations s'exécutent sur le PC local, depuis `local-gateway` :

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\local-gateway
npm run db:migrate
```

`npm run db:migrate` existe aussi dans ce dossier pour un PostgreSQL local, mais le script refuse de tourner si `RENDER` ou `RAILWAY_ENVIRONMENT` est défini.

## Tests

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\backend
npm test
```

Le parcours PostgreSQL réel est `npm run test:integration`. Il exige une base joignable et `TASKFLOW_RUN_INTEGRATION=1`. La procédure complète est dans `docs/developpement-local.md`.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| `503` et message sur le tunnel | PC local éteint, passerelle arrêtée, ou URL Cloudflare périmée |
| `503` « secret refusé » | `LOCAL_GATEWAY_TOKEN` différent entre Render et `local-gateway/.env` |
| Tous les utilisateurs sont déconnectés | `JWT_SECRET` a changé |
| Le navigateur bloque les appels | `FRONTEND_URL` ne contient pas l'origine Vercel |
| Render redémarre sans cesse | Le health check pointe vers `/api/health` pendant une coupure du tunnel |
