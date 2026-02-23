#!/bin/bash
set -e

echo ""
echo "🚀 Starting Stoky share mode..."
echo ""

# Check ngrok is installed
if ! command -v ngrok &> /dev/null; then
  echo "❌ ngrok is not installed."
  echo "   Install it from: https://ngrok.com/download"
  echo "   (download, unzip, move to /usr/local/bin)"
  exit 1
fi

# Kill any leftover ngrok processes
pkill -f ngrok 2>/dev/null || true
sleep 1

# Start ngrok tunnel for the backend (port 8000)
echo "📡 Opening backend tunnel..."
ngrok http 8000 --log=stdout > /tmp/ngrok-backend.log 2>&1 &
sleep 3

# Get the backend ngrok URL from ngrok's local API
BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
tunnels = json.load(sys.stdin)['tunnels']
for t in tunnels:
    if t['proto'] == 'https':
        print(t['public_url'])
        break
" 2>/dev/null)

if [ -z "$BACKEND_URL" ]; then
  echo "❌ Could not get ngrok URL. Is your backend running? (python3 -m uvicorn main:app --port 8000)"
  exit 1
fi

echo "✅ Backend URL: $BACKEND_URL"

# Write it to .env.local so the frontend uses it
echo "VITE_API_URL=$BACKEND_URL/api" > "$(dirname "$0")/frontend/.env.local"

# Restart the frontend dev server
echo ""
echo "🔄 Restarting frontend with new API URL..."
pkill -f "vite" 2>/dev/null || true
sleep 1
cd "$(dirname "$0")/frontend"
npm run dev &> /tmp/vite.log &
sleep 4

# Start ngrok tunnel for the frontend (port 5173)
echo "📡 Opening frontend tunnel..."
ngrok http 5173 --log=stdout > /tmp/ngrok-frontend.log 2>&1 &
sleep 3

# Get the frontend ngrok URL
FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
tunnels = json.load(sys.stdin)['tunnels']
for t in tunnels:
    if t['proto'] == 'https' and '5173' in t['config']['addr']:
        print(t['public_url'])
        break
" 2>/dev/null)

echo ""
echo "============================================"
echo "✅ Ready! Share this link with your reviewer:"
echo ""
echo "   $FRONTEND_URL"
echo ""
echo "============================================"
echo ""
echo "⚠️  Keep this window open while they review."
echo "   Press Ctrl+C when done to stop sharing."
echo ""

# Wait until user presses Ctrl+C
wait
