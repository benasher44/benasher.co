#!/usr/bin/env ruby

require 'yaml'

KEY = 'cached_assets'
WEEK_SECONDS = '604800'

SITE_ROOT = '_site'

def exec(cmd)
  puts cmd
  system cmd
end

cached_assets = YAML.load(File.read("#{KEY}.yml"))[KEY].values
args = cached_assets.map {|f| "--exclude #{f.gsub(/^\//, '')}" }

exec "aws s3 sync #{args.join ' '} --delete _site s3://benasher.co"

cached_assets.each do |f|
  exec "aws s3 cp --cache-control #{WEEK_SECONDS} #{File.join(SITE_ROOT, f)} s3://benasher.co#{f}"
end
