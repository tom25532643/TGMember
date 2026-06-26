#!/bin/sh
set -eu

PROJECT_DIR=/volume1/@appdata/ContainerManager/all_shares/Working/TGMember
DOCKER_COMPOSE=/volume1/@appstore/ContainerManager/usr/bin/docker-compose

cd "$PROJECT_DIR"

case "${1:-deploy}" in
  deploy)
    "$DOCKER_COMPOSE" -f docker-compose.yml build
    "$DOCKER_COMPOSE" -f docker-compose.yml up -d
    "$DOCKER_COMPOSE" -f docker-compose.yml ps
    ;;
  ps)
    "$DOCKER_COMPOSE" -f docker-compose.yml ps
    ;;
  logs)
    shift || true
    "$DOCKER_COMPOSE" -f docker-compose.yml logs --tail=120 "$@"
    ;;
  restart)
    shift || true
    "$DOCKER_COMPOSE" -f docker-compose.yml restart "$@"
    "$DOCKER_COMPOSE" -f docker-compose.yml ps
    ;;
  *)
    echo "Usage: $0 {deploy|ps|logs|restart} [service...]" >&2
    exit 2
    ;;
esac
