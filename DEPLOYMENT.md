# Anantamart Deployment Guide

## Overview
- **Backend**: Django REST API → Render Web Service
- **Frontend**: React SPA → Vercel
- **Database**: PostgreSQL → Aiven (via Render)
- **Cache/Queue**: Redis → Render Redis
- **Media**: Cloudinary CDN
- **Payments**: Razorpay
- **Email**: SMTP (Gmail/Resend)

---

## 🔧 Backend Deployment (Render)

### 1. Prerequisites
- GitHub repository connected to Render
- Aiven PostgreSQL database (or Render PostgreSQL)
- Render Redis instance
- Cloudinary account
- Razorpay account
- SMTP credentials (Gmail App Password or Resend API key)

### 2. Render Service Configuration

#### Create Web Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `anantamart-api` |
| **Region** | `Singapore` (or closest to users) |
| **Branch** | `main` |
| **Runtime** | `Docker` |
| **Dockerfile Path** | `./backend/Dockerfile` |
| **Build Command** | (handled by Dockerfile) |
| **Start Command** | (handled by Dockerfile/entrypoint) |

#### Environment Variables (Required)
Add these in Render → Environment tab:

```bash
# Django Core
SECRET_KEY=<generate-with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DEBUG=False
DJANGO_SETTINGS_MODULE=config.settings.production

# Database (Auto-populated by Render PostgreSQL)
DATABASE_URL=<auto-from-render-postgresql>

# Redis (Auto-populated by Render Redis)
REDIS_URL=<auto-from-render-redis>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Razorpay
RAZORPAY_KEY_ID=rzp_live_<your-key-id>
RAZORPAY_KEY_SECRET=<your-key-secret>

# Email (Gmail App Password or Resend)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=<your-email@gmail.com>
EMAIL_HOST_PASSWORD=<your-app-password>
DEFAULT_FROM_EMAIL=Anantamart <noreply@ananta-mart.in>

# Google OAuth
GOOGLE_CLIENT_ID=<your-client-id.apps.googleusercontent.com>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Admin Notifications
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Frontend URL (for CORS)
FRONTEND_URL=https://ananta-mart.in

# Superuser (Optional - for initial setup)
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@ananta-mart.in
DJANGO_SUPERUSER_PASSWORD=<secure-password>
```

#### Custom Domain
1. In Render service → **Settings** → **Custom Domains**
2. Add: `api.ananta-mart.in`
3. Configure DNS:
   - Type: `CNAME`
   - Name: `api`
   - Value: `<your-service>.onrender.com`

### 3. Database Setup (Aiven PostgreSQL via Render)
1. In Render → **New +** → **PostgreSQL**
2. Name: `anantamart-db`
3. Plan: `Starter` (or higher)
4. Region: Same as web service
5. After creation, copy **External Database URL** → Add as `DATABASE_URL` in web service env vars

### 4. Redis Setup
1. In Render → **New +** → **Redis**
2. Name: `anantamart-redis`
3. Plan: `Starter`
3. Region: Same as web service
4. Copy **External Redis URL** → Add as `REDIS_URL` in web service env vars

### 5. Build & Deploy
- Push to `main` branch → Auto-deploys
- First deploy runs: migrations → collectstatic → creates superuser
- Check logs for any errors

### 6. Health Check
- Endpoint: `https://api.ananta-mart.in/health/`
- Should return: `{"status": "ok", "database": true, "redis": true}`

---

## 🌐 Frontend Deployment (Vercel)

### 1. Prerequisites
- Vercel account connected to GitHub
- Backend API deployed and accessible

### 2. Vercel Project Configuration

#### Create Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New...** → **Project**
3. Import your GitHub repository
4. Configure:

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

#### Environment Variables
Add in Vercel → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_API_URL` | `https://api.ananta-mart.in/api` | Production, Preview |
| `VITE_API_URL` | `http://localhost:8000/api` | Development |
| `VITE_UPI_ID` | `your-upi-id@bank` | All |
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_<your-key-id>` | Production |
| `VITE_RAZORPAY_KEY_ID` | `rzp_test_<your-key-id>` | Preview, Development |
| `VITE_GOOGLE_CLIENT_ID` | `<your-client-id.apps.googleusercontent.com>` | All |

#### Custom Domain
1. In Vercel project → **Settings** → **Domains**
2. Add: `ananta-mart.in` and `www.ananta-mart.in`
3. Configure DNS:
   - Type: `A` → `76.76.21.21` (Vercel IP)
   - Type: `CNAME` → `cname.vercel-dns.com` (for www)

### 3. Build & Deploy
- Push to `main` → Auto-deploys to production
- Pull requests → Preview deployments
- Check build logs for any errors

---

## 🔄 CI/CD Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GitHub    │────▶│   Render    │     │   Vercel    │
│   (main)    │     │  (Backend)  │     │  (Frontend) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │            ┌──────┴──────┐            │
       │            │             │            │
       ▼            ▼             ▼            ▼
   Webhook      Build          Deploy        Build
   Trigger     Docker         Service       Vite
               Image          (Gunicorn)    (Static)
               Migrate        Health        Assets
               Collectstatic  Check         CDN
```

### Automatic Deployments
- **Backend**: Every push to `main` triggers Render build
- **Frontend**: Every push to `main` triggers Vercel production deploy
- **Preview**: Every PR triggers Vercel preview deploy

### Manual Deployments
```bash
# Backend (Render CLI)
render deploy --service anantamart-api

# Frontend (Vercel CLI)
cd frontend && vercel --prod
```

---

## 🔐 Security Checklist

### Backend (Render)
- [ ] `DEBUG=False` in production
- [ ] `SECRET_KEY` from environment (not hardcoded)
- [ ] `SECURE_SSL_REDIRECT=True`
- [ ] `SECURE_HSTS_SECONDS=31536000`
- [ ] `SESSION_COOKIE_SECURE=True`
- [ ] `CSRF_COOKIE_SECURE=True`
- [ ] `CORS_ALLOWED_ORIGINS` only production domains
- [ ] `ALLOWED_HOSTS` only production domains
- [ ] Database SSL required (`ssl_require=True`)
- [ ] Razorpay keys from environment
- [ ] Email credentials from environment

### Frontend (Vercel)
- [ ] `VITE_API_URL` points to production API
- [ ] No API keys in frontend code (only public keys)
- [ ] CSP headers via `vercel.json`
- [ ] HTTPS enforced (automatic on Vercel)

---

## 📊 Monitoring & Logs

### Render Logs
- Dashboard → Service → **Logs**
- Real-time streaming
- Filter by level (info, error, warn)

### Vercel Logs
- Dashboard → Project → **Functions** / **Build Logs**
- Real-time function logs
- Analytics: **Speed Insights**, **Web Analytics**

### Health Checks
```bash
# Backend health
curl https://api.ananta-mart.in/health/

# Frontend health
curl https://ananta-mart.in/
```

---

## 🚨 Troubleshooting

### Common Render Issues

| Issue | Solution |
|-------|----------|
| Build fails: `pip install` | Check `requirements/production.txt` for version conflicts |
| Migrations fail | Check `docker-entrypoint.sh` logs; ensure DB accessible |
| Static files 404 | Verify `collectstatic` ran; check WhiteNoise config |
| 502 Bad Gateway | Check Gunicorn workers; increase timeout in `Dockerfile` |
| CORS errors | Verify `CORS_ALLOWED_ORIGINS` includes Vercel domain |

### Common Vercel Issues

| Issue | Solution |
|-------|----------|
| Build fails: `vite build` | Check `package.json` scripts; ensure all deps in `dependencies` |
| API calls fail | Verify `VITE_API_URL` env var; check CORS on backend |
| 404 on refresh | Ensure `vercel.json` has SPA rewrite rules |
| Environment vars not working | Redeploy after adding vars; check "Environment" scope |

---

## 🔧 Local Development with Production Parity

### Using Docker Compose (Recommended)
```yaml
# docker-compose.yml (create in project root)
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      target: development
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    env_file:
      - ./backend/.env
    depends_on:
      - db
      - redis

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    env_file:
      - ./frontend/.env

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: anantamart
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Frontend Dockerfile.dev
```dockerfile
# frontend/Dockerfile.dev
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

Run: `docker-compose up --build`

---

## 📝 Post-Deployment Verification

### Backend API Tests
```bash
# Health
curl https://api.ananta-mart.in/health/

# Products
curl https://api.ananta-mart.in/api/products/

# Auth
curl -X POST https://api.ananta-mart.in/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### Frontend Tests
1. Visit `https://ananta-mart.in`
2. Test: Home page loads, products display
3. Test: Login/Register flow
4. Test: Add to cart → Checkout → Payment
5. Test: Order history
5. Test: Mobile responsiveness

---

## 🔄 Rollback Procedure

### Render (Backend)
1. Dashboard → Service → **Deploys**
2. Click **...** on previous successful deploy
3. Select **Rollback to this deploy**

### Vercel (Frontend)
1. Dashboard → Project → **Deployments**
2. Click **...** on previous deployment
2. Select **Promote to Production**

---

## 📞 Support Contacts

| Service | Support |
|---------|---------|
| Render | support@render.com |
| Vercel | support@vercel.com |
| Aiven | support@aiven.io |
| Cloudinary | support@cloudinary.com |
| Razorpay | support@razorpay.com |

---

*Last updated: 2026-09-27*