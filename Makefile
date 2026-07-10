# Surgify AI monorepo — frontend/ (Next.js) + backend/ (FastAPI, uv)

.PHONY: install web api dev seed smoke

install:            ## install both apps' dependencies
	cd frontend && npm install
	cd backend && uv sync

web:                ## frontend dev server (http://localhost:3000)
	cd frontend && npm run dev

API_PORT ?= 8000

api:                ## backend dev server (http://localhost:$(API_PORT)); override with make api API_PORT=8001
	cd backend && uv run uvicorn app.main:app --reload --port $(API_PORT)

dev:                ## run frontend + backend together
	$(MAKE) -j2 web api

seed:               ## create tables + demo data
	cd backend && uv run python -m scripts.seed_data

smoke:              ## end-to-end backend check (full forearm-laceration run)
	cd backend && uv run python scripts/smoke_check.py
