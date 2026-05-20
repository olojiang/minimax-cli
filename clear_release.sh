#!/usr/bin/env bash
set -euo pipefail

mkdir -p release
find release -mindepth 1 -maxdepth 1 -exec rm -rf {} +
