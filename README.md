This is the repository for my personal blog and website. It's a static site built with:

## Stack

1. [astro](https://astro.build)
1. [bulma](https://bulma.io)

It's hosted using AWS S3 and Cloudfront and deployed using Github Actions.

## Setup

1. Node 24
1. [yarn](https://yarnpkg.com) (via corepack, vendored in `.yarn/releases`)

To get it running locally, run:

1. `corepack yarn install`
2. `corepack yarn dev`

To build and deploy:

1. `corepack yarn build`
2. `corepack yarn deploy` (needs AWS credentials)

If you give this a try and find steps are missing (or find any other issue), please open a new issue or PR. Thanks!