# Railway Deployment Checklist

## ✅ Completed Steps

1. **MongoDB Atlas Connection** ✅
   - URI: `mongodb+srv://your_user:***@cluster_address/`
   - Connection tested successfully
   - Database name: `mechanic-db`

2. **JWT Secrets Generated** ✅
   - JWT_SECRET: Generated (64 characters)
   - JWT_REFRESH_SECRET: Generated (64 characters)

3. **CORS Configuration** ✅
   - Updated to use environment variables
   - Supports dynamic origins

## 🔄 Next Steps

### 1. Update Gemini API Key
- [ ] Add your Gemini API key to `.env.railway` file
- [ ] Copy to Railway environment variables

### 2. Deploy to Railway

#### Option A: Deploy via GitHub (Recommended)
1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Railway will auto-detect Node.js and deploy

#### Option B: Deploy via Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### 3. Configure Environment Variables in Railway

Go to Railway Dashboard → Your Project → Variables

Copy these from `.env.railway`:
```bash
MONGO_URI=your_mongodb_cluster_uri_here
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_secure_jwt_secret_here
JWT_REFRESH_SECRET=your_secure_refresh_token_secret_here
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
```

### 4. After Deployment

1. **Get Railway URL**
   - Railway will provide: `https://your-app.up.railway.app`

2. **Test Endpoints**
   ```bash
   # Health check
   curl https://your-app.up.railway.app/health
   
   # Root endpoint
   curl https://your-app.up.railway.app/
   ```

3. **Update Frontend/Mobile**
   - Update API URL in frontend: `VITE_API_URL=https://your-app.up.railway.app`
   - Update API URL in mobile: `EXPO_PUBLIC_API_URL=https://your-app.up.railway.app`

4. **Migrate Data** (if needed)
   - Export data from local MongoDB
   - Import to MongoDB Atlas

## 📊 Deployment Status

- [x] MongoDB Atlas configured
- [x] Environment variables prepared
- [x] CORS updated for production
- [ ] Gemini API key added
- [ ] Deployed to Railway
- [ ] Frontend/Mobile updated with production URL
- [ ] Data migrated (if needed)

## 🚨 Important Reminders

1. **Never commit `.env` or `.env.railway` to Git**
2. **Update ALLOWED_ORIGINS** after deploying frontend
3. **Monitor Railway logs** after deployment
4. **Railway free tier**: 500 hours/month, $5 credit
5. **MongoDB Atlas free tier**: 512MB storage

## 📝 Useful Commands

```bash
# Check Railway logs
railway logs

# Open Railway dashboard
railway open

# Link to existing project
railway link

# Add environment variable
railway variables set KEY=value
```

## 🔗 Resources

- Railway Dashboard: https://railway.app/dashboard
- MongoDB Atlas: https://cloud.mongodb.com
- Railway Docs: https://docs.railway.app
