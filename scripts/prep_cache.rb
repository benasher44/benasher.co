#!/usr/bin/env ruby

# frozen_string_literal: true

require 'yaml'

KEY = 'cached_assets'

# get the cached_assets dict
cached_assets = YAML.safe_load(File.read('_config.yml'))[KEY]

# get the commit to use as the cache key
git_commit = `git rev-parse HEAD`.strip

# transform the paths use the cache key
cached_assets.transform_values! do |v|
  path, ext = v.split('.')
  "#{path}-#{git_commit}.#{ext}"
end

# output a new dict
output = { KEY => cached_assets }
File.open("#{KEY}.yml", 'w') { |f| f.write(output.to_yaml) }
