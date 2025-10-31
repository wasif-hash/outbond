This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Railway

Use this guide to deploy the Outbond application (Next.js web app + BullMQ worker) on [Railway](https://railway.app).

### 1. Prerequisites
- GitHub repository with the project source.
- Railway account and CLI (`npm i -g @railway/cli`, then `railway login`).
- Production-ready environment variable values (see below) saved locally for reference.
- Ability to run Prisma migrations locally (`npm install`, `npx prisma generate`).

### 2. Prepare the Repository
- Merge production-ready code into the branch you plan to deploy.
- Commit all Prisma schema changes and generated migrations.
- (Optional) Add a `.railway` folder if you want per-service overrides; defaults below work without it.

### 3. Create the Railway Project
1. Sign in to Railway, click **New Project**, and select **Deploy from GitHub repo**.
2. Choose the Outbond repository and branch.
3. Railway creates the initial service for the Next.js web app.

### 4. Provision Datastores
1. From the project dashboard, add a **PostgreSQL** database (Railway exposes `DATABASE_URL`).
2. Add a **Redis** datastore for BullMQ (`REDIS_URL`).
3. These connection strings must be added as environment variables on each service.

### 5. Configure Environment Variables
Set the following variables for both the **web** and **worker** services unless otherwise noted:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string from Railway. |
| `REDIS_URL` | Yes | Redis connection string from Railway. |
| `JWT_SECRET` | Yes | Long random string for JWT signing. |
| `NEXTJS_URL` | Yes | Public base URL, e.g. `https://<app>.up.railway.app`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Yes | OAuth credentials from Google Cloud. |
| `GOOGLE_REDIRECT_URI` | Yes | Match `https://<app>.up.railway.app/api/auth/google/callback` (and Gmail callback). |
| `GOOGLE_SCOPES` | Yes | Space-delimited scopes required by the app. |
| `GEMINI_API_KEY`, `APOLLO_API_KEY` | Optional | Needed if those integrations are used. |
| `NODE_ENV` | Recommended | Set to `production`. |
| `ALLOW_ADMIN_INIT` | Optional | Temporarily `true` if bootstrapping the admin user, then remove. |
| `NEXT_PUBLIC_APP_URL` | Optional | Use if the client must know the public URL. |
| `LEAD_PREPARATION_CONCURRENCY`, `LEAD_INSERT_BATCH_SIZE`, `EMAIL_SEND_CONCURRENCY` | Optional | Tune BullMQ throughput. |

> Tip: Use Railway **Environment Groups** to share common variables across services.

### 6. Configure the Web Service
1. In the service settings set:
   - **Install**: `npm install`
   - **Build**: `npm run build`
   - **Start**: `npm run start`
2. Ensure the runtime is Node 20.x (Next.js 15 needs ≥ 18).
3. Attach the Postgres and Redis plugins so their URLs sync automatically.
4. Trigger a deploy and confirm the app loads at the Railway URL.

### 7. Configure the Worker Service
1. Add another Railway service pointing to the same GitHub repo and branch.
2. Configure commands:
   - **Install**: `npm install`
   - **Build**: `npm run build`
   - **Start**: `npm run worker`
3. Attach the same environment variables and datastore plugins.
4. Deploy and verify logs show “Lead fetch worker started” and “Email send worker started”.

### 8. Database Migrations & Seeding
- Run migrations after each deploy:

```bash
railway run npx prisma migrate deploy
```

- To push schema changes without migrations: `railway run npx prisma db push`.
- Seed the database when needed: `railway run npm run prisma:seed`.

### 9. Google OAuth Setup
- In Google Cloud Console, add the Railway URL + callback paths (`/api/auth/google/callback`, `/api/auth/google/gmail/callback`) as authorized redirect URIs.
- Update the Railway environment variables whenever OAuth credentials rotate.

### 10. Verification & Operations
- Use `railway logs --service <name>` to confirm healthy Postgres/Redis connections.
- Check `railway run npx prisma migrate status` for migration health.
- Rotate secrets via Railway variables and redeploy services.
- Add a custom domain in Railway networking and update `NEXTJS_URL` (and `NEXT_PUBLIC_APP_URL` if used) to match.
