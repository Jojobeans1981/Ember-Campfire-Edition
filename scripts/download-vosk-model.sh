#!/bin/bash
# Download the Vosk English model for browser-based speech recognition.
# Run once after cloning: bash scripts/download-vosk-model.sh

MODEL_NAME="vosk-model-small-en-us-0.15"
MODEL_URL="https://alphacephei.com/vosk/models/$MODEL_NAME.zip"
DEST_DIR="public/models"

set -e

if [ -d "$DEST_DIR/$MODEL_NAME" ]; then
  echo "Model already exists at $DEST_DIR/$MODEL_NAME"
  exit 0
fi

mkdir -p "$DEST_DIR"
echo "Downloading $MODEL_NAME (~50MB)..."
curl -L -o "/tmp/$MODEL_NAME.zip" "$MODEL_URL"
echo "Extracting..."
unzip -q "/tmp/$MODEL_NAME.zip" -d "$DEST_DIR"
rm "/tmp/$MODEL_NAME.zip"
echo "Done! Model saved to $DEST_DIR/$MODEL_NAME"
