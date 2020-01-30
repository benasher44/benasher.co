#!/usr/bin/env ruby

# frozen_string_literal: true

require 'fileutils'
require 'yaml'

KEY = 'cached_assets'

cached_assets = YAML.safe_load(File.read("#{KEY}.yml"))[KEY]
site_root = File.join Dir.pwd, '_site'
cached_assets.each do |src, dest|
  FileUtils.mv File.join(site_root, src), File.join(site_root, dest)
end
