.DEFAULT_GOAL := build

.PHONY: build
build:
	bundle exec jekyll build

.PHONY: serve
serve:
	bundle exec jekyll serve --drafts

.PHONY: deploy-build
deploy-build:
	./scripts/prep_cache.rb
	bundle exec jekyll build --config _config.yml,cached_assets.yml
	./scripts/fill_cache.rb

.PHONY: deploy
deploy: deploy-build
	./scripts/deploy.rb
	aws cloudfront create-invalidation --distribution-id E2FTU05IZTIYC9 --paths '/*'
