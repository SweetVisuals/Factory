FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install dependencies or handle permissions if needed
USER root

WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Copy package files and install for backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy package files and install for Relay API
COPY companies/Relay/package*.json ./companies/Relay/
RUN cd companies/Relay && npm install

# Copy the entire monorepo into the container
COPY . .

# Set proper permissions for the pptruser
RUN chown -R pptruser:pptruser /usr/src/app

# Switch back to unprivileged user
USER pptruser

WORKDIR /usr/src/app/backend

# Command to run both processes via start.js
CMD [ "npm", "start" ]
