#!/usr/bin/env ruby

require 'fileutils'
require 'yaml'

KEY = 'cached_assets'

cached_assets = YAML.load(File.read("#{KEY}.yml"))[KEY]
site_root = File.join Dir.pwd, '_site'
cached_assets.each do |src, dest|
  FileUtils.mv File.join(site_root, src), File.join(site_root, dest)
end
