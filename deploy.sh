#!/bin/bash
# Oyebill Deployment Script

set -e

echo "🚀 Oyebill Deployment Script"
echo "============================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Commands
COMMAND=${1:-"up"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for Docker
check_docker() {
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Node.js production server command
start_node_server() {
    echo -e "${YELLOW}Starting Node.js production server...${NC}"
    
    # Kill existing server if running
    pkill -f "node.*server.js" 2>/dev/null || true
    sleep 1
    
    # Build frontend if dist doesn't exist
    if [ ! -d "$SCRIPT_DIR/frontend/dist" ]; then
        echo -e "${YELLOW}Building frontend...${NC}"
        cd "$SCRIPT_DIR/frontend" && npm install && npm run build
    fi
    
    # Install backend dependencies if needed
    if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
        echo -e "${YELLOW}Installing backend dependencies...${NC}"
        cd "$SCRIPT_DIR/backend" && npm install
    fi
    
    # Start server with nohup for long-running process
    cd "$SCRIPT_DIR/backend"
    PORT=12000 nohup node src/server.js > /tmp/oyebill.log 2>&1 &
    
    # Also start on port 12001 for secondary access
    PORT=12001 nohup node src/server.js > /tmp/oyebill-12001.log 2>&1 &
    
    sleep 3
    
    # Verify server started
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:12000/ | grep -q "200"; then
        echo -e "${GREEN}✅ Oyebill server started successfully!${NC}"
        echo "   Frontend & API: http://localhost:12000"
        echo "   Secondary: http://localhost:12001"
        echo "   Logs: /tmp/oyebill.log"
    else
        echo -e "${RED}❌ Server failed to start. Check logs at /tmp/oyebill.log${NC}"
        cat /tmp/oyebill.log
        exit 1
    fi
}

stop_node_server() {
    echo -e "${YELLOW}Stopping Node.js server...${NC}"
    pkill -f "node.*server.js" 2>/dev/null || true
    echo -e "${GREEN}✅ Server stopped${NC}"
}

restart_node_server() {
    stop_node_server
    sleep 1
    start_node_server
}

case $COMMAND in
  up|start)
    if check_docker; then
      echo -e "${YELLOW}Building and starting containers...${NC}"
      docker compose up -d --build
      echo -e "${GREEN}✅ Application started!${NC}"
      echo "   Frontend: http://localhost:3000"
      echo "   API: http://localhost:5000"
    else
      echo -e "${YELLOW}Docker not available, using Node.js server${NC}"
      start_node_server
    fi
    ;;
  down|stop)
    if check_docker; then
      echo -e "${YELLOW}Stopping containers...${NC}"
      docker compose down
      echo -e "${GREEN}✅ Containers stopped${NC}"
    else
      stop_node_server
    fi
    ;;
  restart)
    if check_docker; then
      echo -e "${YELLOW}Restarting containers...${NC}"
      docker compose restart
      echo -e "${GREEN}✅ Containers restarted${NC}"
    else
      restart_node_server
    fi
    ;;
  logs)
    if check_docker; then
      docker compose logs -f
    else
      tail -f /tmp/oyebill.log
    fi
    ;;
  build)
    echo -e "${YELLOW}Building frontend...${NC}"
    cd "$SCRIPT_DIR/frontend" && npm run build
    echo -e "${GREEN}✅ Build complete${NC}"
    ;;
  clean)
    echo -e "${YELLOW}Cleaning up...${NC}"
    if check_docker; then
      docker compose down -v --rmi local
    fi
    pkill -f "node.*server.js" 2>/dev/null || true
    rm -f /tmp/oyebill.log
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    ;;
  *)
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up, start     - Build and start containers (or Node.js server if Docker unavailable)"
    echo "  down, stop    - Stop containers or Node.js server"
    echo "  restart       - Restart containers or Node.js server"
    echo "  logs          - View logs"
    echo "  build         - Build frontend only"
    echo "  clean         - Stop and remove containers and clean up"
    exit 1
    ;;
esac