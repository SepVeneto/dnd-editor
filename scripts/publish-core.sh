#!/bin/bash

set -eu

: "${TAG_VERSION:?TAG_VERSION is required}"

pnpm i --frozen-lockfile --registry=https://registry.npmmirror.com

cd packages/core

# 以 tag 为准回写版本号，确保发布出去的版本与 tag 一致
sed -i -E "s/^  \"version\": \"[^\"]*\",/  \"version\": \"$TAG_VERSION\",/" package.json
grep -q "\"version\": \"$TAG_VERSION\"" package.json || {
  echo "❌ 版本号回写失败：$TAG_VERSION" >&2
  exit 1
}

pnpm build

pnpm publish --no-git-checks --access public --registry=https://registry.npmjs.org/

echo "✅ Publish completed"
