# ✅ Railway Deployment - Ready!

## Environment Variables (Copy to Railway)

```bash
# Database
MONGO_URI=your_mongodb_cluster_uri_here

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here

# JWT Secrets
JWT_SECRET=your_secure_jwt_secret_here
JWT_REFRESH_SECRET=your_secure_refresh_token_secret_here

# Server
PORT=5000
NODE_ENV=production

# CORS (Update after deploying frontend)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081
```

## Quick Deploy Steps

### Option 1: GitHub (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Railway deployment"
   git push origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway auto-detects Node.js

3. **Add Environment Variables**
   - Go to project → Variables
   - Copy all variables from above
   - Click "Deploy"

### Option 2: Railway CLI

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Add variables
railway variables set MONGO_URI="your_mongodb_uri"
railway variables set GEMINI_API_KEY="your_api_key"
railway variables set JWT_SECRET="your_jwt_secret"
railway variables set JWT_REFRESH_SECRET="your_refresh_secret"
railway variables set NODE_ENV="production"

# Deploy
railway up
```

## After Deployment

1. **Get Railway URL**: `https://your-app.up.railway.app`

2. **Test Endpoints**:
   ```bash
   curl https://your-app.up.railway.app/health
   ```

3. **Update Frontend**:
   - Update `VITE_API_URL` in frontend `.env`
   - Update `EXPO_PUBLIC_API_URL` in mobile `.env`

4. **Update CORS**:
   - After deploying frontend, update `ALLOWED_ORIGINS` in Railway

## Login Credentials

- **Admin**: `admin@admin.com` / `admin123`
- **Workshop**: `workshop@aswan.com` / `workshop123`
- **Mechanics**: All use `mechanic123`

## Status

- ✅ MongoDB Atlas configured
- ✅ Data seeded (Admin, 6 Mechanics, Workshop, Products)
- ✅ Embeddings generated (AI-powered ✅)
- ✅ Environment variables ready
- ✅ CORS configured
- ✅ Gemini API key added
- ⏳ Ready to deploy!
