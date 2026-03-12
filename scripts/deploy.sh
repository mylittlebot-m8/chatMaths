#!/bin/bash

# ==============================================================================
# ChatTutor Deployment Script
# Steps: Install, Build, Migrate, Start
# ==============================================================================

set -e

echo "🚀 Starting Deployment..."

# 1. Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# 2. Install dependencies
echo "📦 Installing monorepo dependencies..."
pnpm install

# 3. Synchronize Database (Drizzle Push)
echo "🗄️ Synchronizing database schema..."
pnpm db:push

# 4. Build all packages
echo "🏗️ Building project..."
pnpm build

# 5. Start with PM2
echo "🔄 Starting services with PM2..."
pm2 startOrReload ecosystem.config.js

# 6. Save PM2 list to persist on reboot
pm2 save

echo "🎉 Deployment successful!"
pm2 status
