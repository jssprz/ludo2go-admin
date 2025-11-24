#!/bin/bash

# Script to run both Next.js dev server and AdminJS server concurrently
# Usage: ./scripts/dev-with-admin.sh

echo "🚀 Starting Ludo2Go development servers..."
echo ""
echo "📦 Next.js will run on http://localhost:3000"
echo "⚙️  AdminJS will run on http://localhost:3001/admin"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $NEXTJS_PID $ADMINJS_PID 2>/dev/null
    exit 0
}

# Register cleanup function
trap cleanup EXIT INT TERM

# Start Next.js dev server in background
npm run dev &
NEXTJS_PID=$!

# Wait a moment for Next.js to start
sleep 2

# Start AdminJS server in background
npm run admin &
ADMINJS_PID=$!

# Wait for both processes
wait
