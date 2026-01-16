#!/bin/bash

set -e

pnpm i --frozen-lockfile --registry=https://registry.npmmirror.com

cd packages/core

sed -i "s/\"version\": \"0.0.1\",/\"version\": \"$TAG_VERSION\",/" package.json

pnpm build

cd -
npm config set registry https://registry.npmjs.org/
npm publish --no-git-checks --access public -w packages/core

echo "✅ Publish completed"
