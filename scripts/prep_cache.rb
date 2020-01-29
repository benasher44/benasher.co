#!/usr/bin/env ruby

require 'yaml'

KEY = 'cached_assets'

cached_assets = YAML.load(File.read('_config.yml'))[KEY]

git_commit = `git rev-parse HEAD`.strip

cached_assets.transform_values! do |v|
  path, ext = v.split('.')
  "#{path}-#{git_commit}.#{ext}"
end

output = {KEY => cached_assets}

File.open("#{KEY}.yml", 'w') { |f| f.write(output.to_yaml) }

