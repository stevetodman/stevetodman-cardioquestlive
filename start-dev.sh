#!/bin/bash

# Domain from ngrok
NGROK_DOMAIN="tympanitic-nu-yeomanly.ngrok-free.dev"

# Terminal 1 — Voice Gateway
osascript -e 'tell application "Terminal" to do script "cd ~/cardioquestlive/voice-gateway && npm start"'

# Terminal 2 — Dev Proxy
osascript -e 'tell application "Terminal" to do script "cd ~/cardioquestlive/dev-proxy && node index.js"'

# Terminal 3 — Ngrok
osascript -e "tell application \"Terminal\" to do script \"ngrok start cardioquest\""

# Terminal 4 — Vite Dev Server
osascript -e "tell application \"Terminal\" to do script \"cd ~/cardioquestlive && VITE_VOICE_GATEWAY_URL=wss://$NGROK_DOMAIN/ws/voice npm run dev -- --host 0.0.0.0 --port 3000\""

echo "🚀 All services starting..."
echo "👉 Open: https://$NGROK_DOMAIN/"

