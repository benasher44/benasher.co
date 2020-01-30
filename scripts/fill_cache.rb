#!/usr/bin/env ruby

# frozen_string_literal: true

require 'fileutils'
require 'yaml'

KEY = 'cached_assets'

# read the cached_assets yaml to get the paths
cached_assets = YAML.safe_load(File.read("#{KEY}.yml"))[KEY]

# rename all the files to use the cache key
site_root = File.join Dir.pwd, '_site'
cached_assets.each do |src, dest|
  FileUtils.mv File.join(site_root, src), File.join(site_root, dest)
end
