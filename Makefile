.DEFAULT_GOAL := build

.PHONY: build
build:
	bundle exec jekyll build

.PHONY: serve
serve:
	bundle exec jekyll serve
