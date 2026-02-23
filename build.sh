#!/bin/bash
# Builds the React frontend and copies it into the backend/dist folder
# so FastAPI can serve it as a single app.

echo "Building frontend..."
cd "$(dirname "$0")/frontend"
npm install
npm run build

echo "Copying build to backend/dist..."
rm -rf "../backend/dist"
cp -r dist "../backend/dist"

echo "Done! Your app is ready to deploy."
