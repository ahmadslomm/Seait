#!/bin/bash
# Side-by-side room comparison for a given run id.
# Usage: cmp_room.sh <run-id>
set -u
RID="${1:?run id required}"
R=/root/seait-runs/$RID/shots
S=/root/Seait/screenshots
O=/root/parity
mkdir -p "$O"

ORIG=$S/Screenshot_20260720_194030_ZaffaLive.jpg

# full-screen side by side
convert "$ORIG"        -resize x900 /tmp/ro.png
convert "$R/30_room.png" -resize x900 /tmp/rs.png
montage -label "ORIGINAL" /tmp/ro.png -label "SEAIT ($RID)" /tmp/rs.png \
  -tile 2x1 -geometry +8+8 -background '#141021' -fill white -pointsize 18 "$O/room_$RID.png"

# seat-grid close-up: original seats occupy y 380..1280 of 3088
convert "$ORIG" -crop 1440x900+0+380 +repage -resize 640x /tmp/so.png
# emulator shot is 640x1280; seats sit just under the top bar
convert "$R/30_room.png" -crop 640x420+0+110 +repage -resize 640x /tmp/ss.png
montage -label "ORIGINAL seats" /tmp/so.png -label "SEAIT seats" /tmp/ss.png \
  -tile 1x2 -geometry +6+6 -background '#141021' -fill white -pointsize 16 "$O/seats_$RID.png"

echo "wrote $O/room_$RID.png and $O/seats_$RID.png"
