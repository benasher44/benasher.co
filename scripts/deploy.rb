#!/usr/bin/env ruby

# frozen_string_literal: true

require 'yaml'

KEY = 'cached_assets'
WEEK_SECONDS = '604800'

SITE_ROOT = '_site'

def exec(cmd)
  puts cmd
  system cmd
end

cached_assets = YAML.safe_load(File.read("#{KEY}.yml"))[KEY].values
args = cached_assets.map { |f| "--exclude #{f.gsub(%r{^/}, '')}" }

exec "aws s3 sync #{args.join ' '} --delete _site s3://benasher.co"

cached_assets.each do |f|
  path = File.join(SITE_ROOT, f)
  exec "aws s3 cp --cache-control #{WEEK_SECONDS} #{path} s3://benasher.co#{f}"
end
