SHELL := /bin/bash

.PHONY: help first_launch install install-back install-front env env-back env-front db-up db-down db-logs back front dev build test

help:
	@echo "Available commands:"
	@echo "  make first_launch Prepare full first project launch"
	@echo "  make install      Install backend and frontend dependencies"
	@echo "  make env          Create .env files if missing"
	@echo "  make db-up        Start PostgreSQL container"
	@echo "  make db-down      Stop PostgreSQL container"
	@echo "  make db-logs      Follow PostgreSQL logs"
	@echo "  make back         Run NestJS backend in dev mode"
	@echo "  make front        Run React frontend in dev mode"
	@echo "  make dev          Run backend and frontend together"
	@echo "  make build        Build backend and frontend"
	@echo "  make test         Run backend tests"

install: install-back install-front

install-back:
	npm install

install-front:
	npm --prefix web install

env: env-back env-front

env-back:
	@if [ ! -f ".env" ]; then cp .env.example .env; echo "Created .env from .env.example"; else echo ".env already exists"; fi

env-front:
	@if [ ! -f "web/.env" ]; then cp web/.env.example web/.env; echo "Created web/.env from web/.env.example"; else echo "web/.env already exists"; fi

first_launch:
	@echo "Step 1/5 - Installing dependencies"
	@$(MAKE) install
	@echo ""
	@echo "Step 2/5 - Creating env files"
	@$(MAKE) env
	@echo ""
	@echo "Step 3/5 - Starting database"
	@$(MAKE) db-up
	@echo ""
	@echo "Step 4/5 - Building backend and frontend"
	@$(MAKE) build
	@echo ""
	@echo "Step 5/5 - Launching project (backend + frontend)"
	@$(MAKE) dev

db-up:
	docker compose up -d

db-down:
	docker compose down

db-logs:
	docker compose logs -f db

back:
	npm run start:dev

front:
	npm --prefix web run dev

dev: db-up
	@$(MAKE) -j2 back front

build:
	npm run build
	npm --prefix web run build

test:
	npm test
