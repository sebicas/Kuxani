---
description: How to deploy Kuxani to Coolify with PostgreSQL and MinIO
---

# Deploy Kuxani to Coolify

Complete guide to deploying the Kuxani Next.js application on a Coolify instance, including setting up PostgreSQL and MinIO services.

## Environments

| Environment     | Domain                   | Git Branch    |
| --------------- | ------------------------ | ------------- |
| **Production**  | `https://kuxani.com`     | `main`        |
| **Development** | `https://dev.kuxani.com` | `development` |

> [!IMPORTANT]
> You should create **two separate Coolify applications** — one for each environment — each pointing to its respective Git branch. Each environment needs its own PostgreSQL database and MinIO instance (or shared MinIO with separate buckets).

---

## Prerequisites

- A running **Coolify** instance (v4+) with a connected server
- Your **Kuxani Git repository** accessible from Coolify (GitHub)
- DNS A records for `kuxani.com` and `dev.kuxani.com` pointed to your Coolify server

---

## Step 1: Create PostgreSQL Service

1. In Coolify, go to **Projects** → select your project (or create one)
2. Click **+ New** → **Database** → **PostgreSQL**
3. Select version **17** (matches development)
4. Configure the service:
   - **Name**: `kuxani-postgres` (production) / `kuxani-postgres-dev` (development)
   - **Default Database**: `kuxani`
   - **Username**: `kuxani`
   - **Password**: Generate a strong password (save it for later)
5. Click **Deploy**
6. Once running, copy the **Internal Connection URL**:
   ```
   postgres://kuxani:<password>@kuxani-postgres:5432/kuxani
   ```
   > **Note**: Use the **internal** URL (not public) since the app and DB run on the same Coolify server.

---

## Step 2: Create MinIO Service

1. In the same project, click **+ New** → **Service** → search for **MinIO** (or use Docker Image)
2. If using Docker Image directly:
   - **Image**: `minio/minio:latest`
   - **Command**: `server /data --console-address ":9001"`
3. Configure environment variables:
   ```
   MINIO_ROOT_USER=<generate-access-key>
   MINIO_ROOT_PASSWORD=<generate-secret-key>
   ```
4. Configure **Storage**:
   - Add a persistent volume mounted at `/data`
5. Configure **Network**:
   - **Port 9000**: MinIO API (used by the app) — expose internally
   - **Port 9001**: MinIO Console (web UI) — optionally expose with a domain for admin access (e.g., `minio.kuxani.com`)
6. Click **Deploy**
7. Note the **internal hostname** (e.g., `kuxani-minio`) and port for later

### Create the Upload Bucket

After MinIO is running:

1. Open the MinIO Console (port 9001 web UI)
2. Log in with your `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
3. Go to **Buckets** → **Create Bucket**
4. Name: `kuxani-uploads` (production) / `kuxani-uploads-dev` (development)
5. Set access policy to **Private** (the app will use pre-signed URLs)

---

## Step 3: Deploy the Kuxani Application

Repeat this for **each environment** (production and development):

1. In the same project, click **+ New** → **Application**
2. Select your **Git repository** and the appropriate branch:
   - **Production**: `main` branch
   - **Development**: `development` branch
3. Configure the build:
   - **Build Pack**: **Dockerfile**
   - **Dockerfile Location**: `/Dockerfile` (root of the repo)
4. Click **Continue**

---

## Step 4: Configure Environment Variables

In the application settings, go to **Environment Variables** and add:

### Required Variables

| Variable             | Production                                            | Development                                               |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`       | `postgres://kuxani:<pwd>@kuxani-postgres:5432/kuxani` | `postgres://kuxani:<pwd>@kuxani-postgres-dev:5432/kuxani` |
| `BETTER_AUTH_SECRET` | `<generate with openssl rand -hex 32>`                | `<generate with openssl rand -hex 32>`                    |
| `BETTER_AUTH_URL`    | `https://kuxani.com`                                  | `https://dev.kuxani.com`                                  |
| `OPENAI_API_KEY`     | `sk-...`                                              | `sk-...`                                                  |
| `MINIO_ENDPOINT`     | `kuxani-minio`                                        | `kuxani-minio`                                            |
| `MINIO_PORT`         | `9000`                                                | `9000`                                                    |
| `MINIO_ACCESS_KEY`   | `<your-minio-access-key>`                             | `<your-minio-access-key>`                                 |
| `MINIO_SECRET_KEY`   | `<your-minio-secret-key>`                             | `<your-minio-secret-key>`                                 |
| `MINIO_BUCKET`       | `kuxani-uploads`                                      | `kuxani-uploads-dev`                                      |

### Build-Time Variables (Build Args)

These are needed at **build time** for Next.js public environment variables:

| Variable              | Production            | Development               |
| --------------------- | --------------------- | ------------------------- |
| `NEXT_PUBLIC_APP_URL` | `https://kuxani.com`  | `https://dev.kuxani.com`  |
| `NEXT_PUBLIC_WS_URL`  | `wss://ws.kuxani.com` | `wss://ws.dev.kuxani.com` |

> [!IMPORTANT]
> In Coolify, mark `NEXT_PUBLIC_*` variables as **"Build Variable"** so they are available during `docker build`. Runtime-only env vars won't be embedded into the Next.js client bundle.

---

## Step 5: Configure Domain & SSL

1. In the application settings, go to **General** → **Domains**
2. Add the domain for the environment:
   - **Production**: `https://kuxani.com`
   - **Development**: `https://dev.kuxani.com`
3. Coolify will automatically provision a **Let's Encrypt** SSL certificate
4. Ensure your DNS A records point to the Coolify server's IP:
   - `kuxani.com` → `<server-ip>`
   - `dev.kuxani.com` → `<server-ip>`

---

## Step 6: Deploy

1. Click **Deploy** in Coolify
2. Monitor the build logs — you should see:
   - Dependencies installed (`npm ci`)
   - Next.js build completed
   - Image pushed and container started
3. On first start, the container runs `drizzle-kit migrate` to apply database migrations before starting the server

---

## Step 7: Post-Deployment Verification

1. Visit the appropriate URL:
   - **Production**: `https://kuxani.com`
   - **Development**: `https://dev.kuxani.com`
2. Navigate to `/login` and `/signup` to verify auth is working
3. Check the Coolify logs for any runtime errors

### Troubleshooting

| Issue                           | Solution                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| **Database connection refused** | Verify the internal hostname in `DATABASE_URL` matches the PostgreSQL service name in Coolify |
| **Migrations fail**             | Check the container logs; ensure `DATABASE_URL` is set correctly                              |
| **NEXT_PUBLIC vars missing**    | Ensure they are marked as "Build Variable" in Coolify                                         |
| **MinIO upload errors**         | Verify `MINIO_ENDPOINT` uses the internal hostname, not `localhost`                           |
| **SSL not working**             | Ensure DNS is pointed correctly; Coolify handles certs automatically                          |

---

## Updating the Application

To deploy updates:

1. Push changes to your Git repository (`main` or `development` branch)
2. Coolify will auto-deploy if **Webhooks** are configured, or click **Deploy** manually
3. Migrations run automatically on each container start

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Coolify Server                           │
│                                                                  │
│  ┌─────────────────────── Production ─────────────────────────┐  │
│  │  Kuxani App (:3000)  │  PostgreSQL (:5432)  │  MinIO (:9K) │  │
│  │  kuxani.com          │  kuxani-postgres      │  kuxani-minio│  │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────── Development ────────────────────────┐  │
│  │  Kuxani App (:3000)  │  PostgreSQL (:5432)  │  MinIO (:9K) │  │
│  │  dev.kuxani.com      │  kuxani-postgres-dev  │  (shared)    │  │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                        Internal Network                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                       HTTPS :443
                            │
                       ┌────┴────┐
                       │  Users  │
                       └─────────┘
```
