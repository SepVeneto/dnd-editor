#!/bin/bash

set -e

pnpm i --frozen-lockfile --registry=https://registry.npmmirror.com

cd packages/plugins

sed -i "s/\"version\": \"0.0.1\",/\"version\": \"$TAG_VERSION\",/" package.json

pnpm build

npm publish --no-git-checks --access public

echo "✅ Publish completed"
