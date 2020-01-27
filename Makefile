.DEFAULT_GOAL := build

.PHONY: build
build:
	bundle exec jekyll build

.PHONY: serve
serve:
	bundle exec jekyll serve

deploy:
	aws s3 sync --delete --dryrun _site s3://benasher.co
	aws cloudfront create-invalidation --distribution-id E2FTU05IZTIYC9 --paths '*'
