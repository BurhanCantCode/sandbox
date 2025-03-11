#!/bin/bash

# Install dependencies
npm install

# Copy example env file if .env.local doesn't exist
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "Created .env.local file. Please update it with your API keys."
fi

echo "Installation complete! Run 'npm run dev' to start the development server." 