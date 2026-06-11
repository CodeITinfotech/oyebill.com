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
RUN npm ci --omit=dev

# Copy and configure nginx for serving static files
RUN apk add --no-cache nginx

# Configure nginx with proper API proxy settings
RUN cat > /etc/nginx/http.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Static files
    root /app/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy with timeouts
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts to prevent 502 errors
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # SPA routing - serve index.html for all non-file requests
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Default server to prevent security issues
server {
    listen 8080;
    server_name _;
    return 444;
}
EOF

EXPOSE 80 5000

# Start services with proper process management
# Use exec to avoid PID 1 issues and enable proper signal handling
CMD sh -c 'echo "Starting services..." && nginx -g "daemon off;" & NODE_PID="" && node /app/backend/src/index.js & wait'