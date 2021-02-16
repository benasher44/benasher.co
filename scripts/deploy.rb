#!/usr/bin/env ruby

# frozen_string_literal: true

require 'aws-sdk-cloudfront'
require 'aws-sdk-s3'
require 'yaml'

BUCKET = 'benasher.co'

KEY = 'cached_assets'
WEEK_SECONDS = '604800'

SITE_ROOT = '_site'

CONTENT_TYPES = {
  css: 'text/css',
  html: 'text/html',
  ico: 'image/vnd.microsoft.icon',
  map: 'application/octet-stream',
  png: 'image/png',
  txt: 'text/plain',
  xml: 'application/xml'
}.freeze

def content_type(path)
  ext = File.extname(path).gsub(/^\./, '').to_sym
  raise "Missing content-type for extension #{ext} (#{path})" unless CONTENT_TYPES.include? ext

  CONTENT_TYPES[ext]
end

def enumerate_site_files
  Dir.chdir(SITE_ROOT) do
    Dir.glob('**/*').each do |path|
      next if File.directory? path

      yield path
    end
  end
end

def validate_content_types!
  enumerate_site_files do |path|
    # should not raise
    content_type(path)
  end
end

validate_content_types!

s3 = Aws::S3::Client.new

existing_keys = Set.new
s3.list_objects(bucket: BUCKET).each do |response|
  response.contents.map(&:key).each { |k| existing_keys.add k }
end

# get the cached_assets to exclude them from sync
cached_assets = YAML.safe_load(File.read("#{KEY}.yml"))[KEY].values
cached_asset_paths = Set.new(cached_assets.map { |f| f.gsub(%r{^/}, '') })

enumerate_site_files do |path|
  next if File.directory? path

  File.open(path) do |file|
    params = {
      bucket: BUCKET,
      key: path,
      body: file,
      content_type: content_type(path)
    }
    params[:cache_control] = "max-age=#{WEEK_SECONDS}" if cached_asset_paths.include? path

    puts "Putting #{path}"
    s3.put_object(params)

    # track uploaded files to remove left overs at the end
    existing_keys.delete(path)
  end
end

unless existing_keys.empty?

  puts "Deleting #{existing_keys}"
  s3.delete_objects(
    bucket: BUCKET,
    delete: {
      objects: existing_keys.map { |k| { key: k } }
    }
  )
end

# bounce cloudfront caches
Aws::CloudFront::Client.new.create_invalidation(
  distribution_id: ENV['AWS_CF_DISTRIBUTION_ID'],
  invalidation_batch: {
    paths: { quantity: 1, items: ['/*'] },
    caller_reference: Time.now.to_s
  }
)
