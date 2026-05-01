#!/usr/bin/env bash
# Copies web app files into ha-addon/www/ so the add-on Dockerfile can COPY them.
# Run this from the repo root before building the Docker image.
set -euo pipefail

DEST="$(dirname "$0")/../ha-addon/www"
SRC="$(dirname "$0")/.."

rm -rf "$DEST"
mkdir -p "$DEST"

cp "$SRC/index.html"   "$DEST/"
cp "$SRC/version.json" "$DEST/"
cp -r "$SRC/js"        "$DEST/"
cp -r "$SRC/css"       "$DEST/"
cp -r "$SRC/images"    "$DEST/"

echo "Web files copied to ha-addon/www/"
echo "To build: cd ha-addon && docker build --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.20 -t givenergy-dashboard ."
