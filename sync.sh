#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

npm run build:web
ossutil cp -r release/web/ oss://i9257/ --update
