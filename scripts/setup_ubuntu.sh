#!/mbin/bash

# ==============================================================================
# ChatTutor Ubuntu 22.04 Deployment Setup Script
# Includes: Node.js, Bun, Pnpm, PM2, PostgreSQL, FFmpeg
# ==============================================================================

set -e

echo "🚀 Starting System Dependencies Installation..."

# 1. Update system
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install basic tools
sudo apt-get install -y curl wget git build-essential ffmpeg

# 3. Install Node.js (LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Install Bun
echo "📦 Installing Bun..."
curl -fsSL https://bun.sh/install | bash
# Access bun in current session
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# 5. Install Pnpm
echo "📦 Installing Pnpm..."
sudo npm install -g pnpm

# 6. Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 7. Install PostgreSQL 16
echo "📦 Installing PostgreSQL 16..."
sudo apt-get install -y gnupg2
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update
sudo apt-get install -y postgresql-16

# 8. Setup PostgreSQL Database
echo "🗄️ Setting up PostgreSQL database..."
# Replace 'Ai11223344' with your actual password if changed in .env
sudo -u postgres psql -c "CREATE USER chattutor WITH PASSWORD 'Ai11223344';" || true
sudo -u postgres psql -c "CREATE DATABASE chattutor OWNER chattutor;" || true

# 9. Verify installations
echo "✅ Installation Summary:"
node -v
pnpm -v
pm2 -v
bun -v
psql --version
ffmpeg -version

echo "🎉 System setup complete! Please run 'source ~/.bashrc' to update your path."
