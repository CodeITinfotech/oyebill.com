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

case $COMMAND in
  up|start)
    echo -e "${YELLOW}Building and starting containers...${NC}"
    docker-compose up -d --build
    echo -e "${GREEN}✅ Application started!${NC}"
    echo "   Frontend: http://localhost:3000"
    echo "   API: http://localhost:5000"
    ;;
  down|stop)
    echo -e "${YELLOW}Stopping containers...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ Containers stopped${NC}"
    ;;
  restart)
    echo -e "${YELLOW}Restarting containers...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ Containers restarted${NC}"
    ;;
  logs)
    docker-compose logs -f
    ;;
  build)
    echo -e "${YELLOW}Building image...${NC}"
    docker-compose build --no-cache
    echo -e "${GREEN}✅ Build complete${NC}"
    ;;
  clean)
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker-compose down -v --rmi local
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    ;;
  *)
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up, start     - Build and start containers"
    echo "  down, stop    - Stop containers"
    echo "  restart       - Restart containers"
    echo "  logs          - View logs"
    echo "  build         - Build image without cache"
    echo "  clean         - Stop and remove containers and images"
    exit 1
    ;;
esac