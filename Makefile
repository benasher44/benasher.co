.DEFAULT_GOAL := build

.PHONY: build
build:
	bundle exec jekyll build

.PHONY: serve
serve:
	bundle exec jekyll serve --drafts

.PHONY: live-serve
live-serve:
	bundle exec jekyll serve --drafts --livereload

.PHONY: deploy-build
deploy-build:
	./scripts/prep_cache.rb
	bundle exec jekyll build --config _config.yml,cached_assets.yml
	./scripts/fill_cache.rb

.PHONY: deploy
deploy: deploy-build
	bundle exec ruby ./scripts/deploy.rb
