#!/bin/bash

set -e

pnpm i --frozen-lockfile --registry=https://registry.npmmirror.com

pnpm build:core

cd packages/editor

sed -i "s/\"version\": \"0.0.1\",/\"version\": \"$TAG_VERSION\",/" package.json

pnpm build

pnpm publish --no-git-checks --access public --tag beta --registry=https://registry.npmjs.org/

echo "✅ Publish completed"
