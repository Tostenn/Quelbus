#!/bin/sh
# Assemble l'image et la musique, son normalisé à -14 LUFS (niveau des réseaux sociaux).
set -eu
cd "$(dirname "$0")"
ffmpeg -loglevel error -y -i out/video-muet.mp4 -i music.wav \
  -filter_complex "[1:a]loudnorm=I=-14:TP=-1.5:LRA=9[a]" -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart out/quelbus-correspondances-tiktok.mp4
echo "out/quelbus-correspondances-tiktok.mp4 prêt"
