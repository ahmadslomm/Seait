#!/bin/bash
# Convert an "RGB | ALPHA" side-by-side decoration mp4 (as shipped inside the
# infoBgImg CDN zip) into an animated WebP with REAL alpha, which Skia can
# composite — unlike video_player's platform texture. See docs/ANIMATED_HEADER.md.
#
# Usage: convert_decoration.sh <in.mp4> <out.webp> [split_px] [out_w] [out_h]
set -eu
IN=${1:?input mp4}; OUT=${2:?output webp}
SPLIT=${3:-757}          # measured x where the alpha region begins
OW=${4:-379}; OH=${5:-840}
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 "$IN")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$IN")
AW=$((W - SPLIT))        # alpha region is half the colour region's width
ffmpeg -y -i "$IN" -filter_complex \
"[0:v]crop=${SPLIT}:${H}:0:0,scale=${OW}:${OH}[rgb];\
 [0:v]crop=${AW}:${H}:${SPLIT}:0,scale=${OW}:${OH},format=gray[a];\
 [rgb][a]alphamerge[out]" \
-map "[out]" -frames:v 60 -loop 0 -c:v libwebp -lossless 0 -q:v 55 "$OUT"
echo "wrote $OUT ($(stat -c%s "$OUT") bytes)"
