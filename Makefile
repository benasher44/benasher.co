.DEFAULT_GOAL := build

.PHONY: build
build:
	corepack yarn build

.PHONY: serve
serve:
	corepack yarn dev

.PHONY: preview
preview:
	corepack yarn preview

.PHONY: deploy
deploy:
	corepack yarn deploy