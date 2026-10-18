.PHONY: setup dev build test lint
setup:
	npm ci
dev:
	npm run dev
build:
	npm run build
test:
	npm test
lint:
	npm run lint
