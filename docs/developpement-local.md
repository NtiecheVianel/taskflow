# Développement local — trois composants

Le frontend public est déjà sur Vercel. Le backend public est déjà sur Render (`https://taskflow-backend-k9wq.onrender.com`). En développement comme en démonstration, le navigateur continue d'appeler Render.

Tout ce qui est local tient sur **un seul PC** : PostgreSQL, la passerelle et le tunnel. Ils se parlent en `127.0.0.1`. Aucun second ordinateur n'est nécessaire. Le frontend Vercel et le backend Render restent dans le cloud.

## Sur le PC local — PostgreSQL, passerelle, tunnel

### 1. Créer le rôle et la base

Ouvrir une invite `psql` avec le compte administrateur local (le mot de passe de `postgres` n'est pas dans le dépôt) :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres
```

Si la connexion est refusée sur 5432, essayer le port 5433 : les services PostgreSQL 17 et 18 peuvent écouter sur des ports différents.

```sql
CREATE USER taskflow_app WITH PASSWORD 'choisir_un_mot_de_passe_long';
CREATE DATABASE taskflow OWNER taskflow_app;
\q
```

### 2. Configurer et migrer

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\local-gateway
Copy-Item .env.example .env
notepad .env
npm install
npm run db:migrate
npm run dev
```

`.env` doit contenir `DB_PASSWORD`, `DB_NAME=taskflow`, `DB_USER=taskflow_app`, `HOST=127.0.0.1`, `PORT=4000` et `LOCAL_GATEWAY_TOKEN`.

Laisser cette fenêtre ouverte. Le journal doit afficher `Passerelle TaskFlow sur http://127.0.0.1:4000`.

### 3. Ouvrir le tunnel

Nouveau terminal PowerShell :

```powershell
cloudflared tunnel --url http://127.0.0.1:4000
```

Installation si la commande est inconnue :

```powershell
winget install --id Cloudflare.cloudflared
```

Copier l'URL `https://....trycloudflare.com`.

### 4. Brancher Render

Dans le service Render existant, variables d'environnement :

```text
NODE_ENV=production
JWT_SECRET=<nouveau secret, obligatoire>
JWT_EXPIRES_IN=24h
LOCAL_GATEWAY_URL=https://....trycloudflare.com
LOCAL_GATEWAY_TOKEN=<exactement celui du .env local>
FRONTEND_URL=https://<le-projet-vercel>.vercel.app
```

Ne pas ajouter `DB_HOST` ni `DB_PASSWORD` sur Render.

Redéployer le backend **après** que ce code est poussé sur la branche déployée par Render. Tant que ce déploiement n'est pas fait, Render continue d'utiliser l'ancien stockage en mémoire.

Health check Render : chemin `/`. Pas `/api/health`.

Le frontend Vercel n'a pas besoin d'une nouvelle URL d'API : `frontend/src/lib/api.ts` pointe déjà vers Render.

## Utiliser l'application

Rien d'autre à installer pour la démonstration : ouvrir l'URL Vercel sur ce même PC, créer un compte, créer une tâche.

Vérifier la ligne dans PostgreSQL, dans un autre terminal :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5432 -U taskflow_app -d taskflow -c "SELECT id, title, status FROM tasks ORDER BY created_at DESC LIMIT 5;"
```

Pour travailler sur l'interface en local, le client ignore `localhost` et appelle quand même Render :

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\frontend
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Montrer la coupure

1. Créer une tâche depuis Vercel. Elle est dans PostgreSQL.
2. Arrêter `cloudflared`, ou fermer la fenêtre `npm run dev` de la passerelle.
3. Recharger le tableau de bord : la bannière d'erreur s'affiche, les routes de données répondent `503`. Render lui-même reste en ligne (`GET /`).
4. Relancer la passerelle puis `cloudflared`.
5. Si l'URL du tunnel a changé, la coller dans `LOCAL_GATEWAY_URL` et redéployer ou redémarrer le service Render.
6. Recharger : la tâche est toujours là.

## Tests réellement locaux

Sans Docker et sans base :

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\backend
npm test
cd ..\local-gateway
npm test
```

Avec une base jetable (ne touche pas au cluster PostgreSQL 17/18) :

```powershell
docker run -d --name taskflow-pg-test -e POSTGRES_USER=taskflow -e POSTGRES_PASSWORD=taskflow_test_pw -e POSTGRES_DB=taskflow_test -p 54329:5432 postgres:16-alpine
```

Attendre que le conteneur accepte les connexions, puis :

```powershell
cd C:\Users\leone\Desktop\Projets\Taskflow\backend
$env:TASKFLOW_RUN_INTEGRATION = '1'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '54329'
$env:DB_NAME = 'taskflow_test'
$env:DB_USER = 'taskflow'
$env:DB_PASSWORD = 'taskflow_test_pw'
$env:DB_SSL = 'false'
npm run test:integration
```

Le mot de passe `taskflow_test_pw` ne sert qu'à ce conteneur. Ne pas le réutiliser pour `taskflow_app`.

Arrêter le conteneur :

```powershell
docker rm -f taskflow-pg-test
```
