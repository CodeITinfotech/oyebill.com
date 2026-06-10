# Multi-stage Dockerfile for Oyebill Restaurant Billing System
# This Dockerfile builds both frontend and backend into a single image
# The preview server serves static files and proxies API requests

FROM node:18-alpine AS builder

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built frontend
COPY --from=builder /app/frontend/dist ./dist
COPY --from=builder /app/frontend/package.json ./

# Copy backend
COPY backend/package*.json ./backend/
COPY backend/src ./backend/src
COPY backend/database ./backend/database

# Install production dependencies for backend
WORKDIR /app/backend
RUN npm ci --only=production

# Install preview server dependencies
WORKDIR /app
RUN npm ci --only=production

# Copy and configure nginx for serving static files
RUN apk add --no-cache nginx
RUN echo 'server { listen 80; server_name _; root /app/dist; index index.html; try_files $uri $uri/ /index.html; location /api/ { proxy_pass http://localhost:5000; } }' > /etc/nginx/http.d/default.conf

EXPOSE 80 5000

# Start services
CMD sh -c 'nginx & node /app/backend/src/index.js &'