#!/bin/bash
# Seait emulator driver — runs ON THE WORKER (83.136.208.47), detached.
#
# Usage: run_seait.sh <RUN_ID>
#   RUN_ID is assigned by the controller so it knows exactly which artefact to
#   wait for. Every run gets its own directory and NOTHING is ever overwritten.
#
# Concurrency: a flock-based lock makes overlapping runs impossible; a second
# run blocks until the first finishes (or gives up after LOCK_WAIT seconds).
set -u
export PATH=$PATH:/opt/android-sdk/platform-tools:/root/android-sdk/platform-tools:/usr/lib/android-sdk/platform-tools

CTRL=140.82.32.124
RUNS=/root/seait-runs
LOCK=$RUNS/.lock
LOCK_WAIT=1800
PKG=com.example.seait

RUN_ID="${1:-$(date +%Y%m%d-%H%M%S)}"
RUN_DIR="$RUNS/$RUN_ID"
mkdir -p "$RUNS"

# ── refuse to clobber a previous run ────────────────────────────────
if [ -e "$RUN_DIR" ]; then
  echo "run id $RUN_ID already exists — refusing to overwrite" >&2
  exit 3
fi
mkdir -p "$RUN_DIR"/{shots,logs,video}

LOG="$RUN_DIR/logs/run.log"
: > "$LOG"
# Every line carries the active run id (requirement 7).
say(){ echo "[$RUN_ID] $(date +%H:%M:%S) $*" | tee -a "$LOG" >/dev/null; }
run(){ echo "[$RUN_ID] \$ $*" >>"$LOG"; "$@" >>"$LOG" 2>&1; }

shot(){ # shot <name> [settle]
  sleep "${2:-3}"
  adb exec-out screencap -p > "$RUN_DIR/shots/$1.png" 2>>"$LOG"
  say "shot $1 = $(stat -c%s "$RUN_DIR/shots/$1.png" 2>/dev/null)B"
}
open(){ run adb shell am start -a android.intent.action.VIEW -d "seait://$1" "$PKG"; }

# ── serialise runs ──────────────────────────────────────────────────
exec 9>"$LOCK"
say "waiting for run lock (max ${LOCK_WAIT}s)"
if ! flock -w "$LOCK_WAIT" 9; then
  say "FAILED to acquire lock — another run is still active"
  exit 4
fi
say "lock acquired; run dir = $RUN_DIR"
trap 'say "releasing lock"; flock -u 9' EXIT

# ── device ──────────────────────────────────────────────────────────
run adb start-server
run adb wait-for-device
say "abi=$(adb shell getprop ro.product.cpu.abi 2>/dev/null | tr -d '\r')"

say "phone geometry"
run adb shell wm size 1080x2340
sleep 3
SZ=$(adb shell wm size 2>/dev/null | tr -d '\r' | tail -1 | awk -F': ' '{print $2}')
PW=$(echo "$SZ" | cut -dx -f1); PH=$(echo "$SZ" | cut -dx -f2)
PW=${PW:-640}; PH=${PH:-1280}
DENS=$(( PW * 160 / 411 ))
run adb shell wm density "$DENS"
sleep 4
say "geometry ${PW}x${PH} density=$DENS ($(( PW*160/DENS ))dp wide)"

# ── fetch + install ─────────────────────────────────────────────────
APK="$RUN_DIR/seait.apk"
say "fetching APK"
curl -sS -m 900 -o "$APK" "http://$CTRL:8078/seait.apk" >>"$LOG" 2>&1
say "apk bytes=$(stat -c%s "$APK" 2>/dev/null) md5=$(md5sum "$APK" | cut -c1-12)"
curl -s -m 10 -o /dev/null -w "worker->backend http=%{http_code}\n" "http://$CTRL:8077/api.php" >>"$LOG" 2>&1

say "install"
adb uninstall "$PKG" > "$RUN_DIR/logs/uninstall.log" 2>&1
adb install -r -t "$APK" > "$RUN_DIR/logs/install.log" 2>&1
say "install result: $(tail -1 "$RUN_DIR/logs/install.log")"
adb shell dumpsys package "$PKG" > "$RUN_DIR/logs/dumpsys_package.log" 2>&1
say "installed versionName=$(grep -m1 versionName "$RUN_DIR/logs/dumpsys_package.log" | tr -d ' \r')"

# ── launch ──────────────────────────────────────────────────────────
run adb logcat -c
run adb shell input keyevent KEYCODE_WAKEUP
run adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
sleep 30
shot 00_launch 6

W=$PW; H=$PH
tapf(){ run adb shell input tap $(( W * $1 / 100 )) $(( H * $2 / 100 )); }
swipeup(){ run adb shell input swipe $((W/2)) $((H*75/100)) $((W/2)) $((H*30/100)) 400; sleep 2; }

# ── screen recording over the interactive part ──────────────────────
say "start screenrecord"
( adb shell screenrecord --time-limit 170 --size 640x1280 /sdcard/seait_$RUN_ID.mp4 >/dev/null 2>&1 ) &
REC_PID=$!

say "bottom nav sweep"
tapf 10 97; shot 01_home 6
tapf 30 97; shot 02_moment 5
tapf 50 97; shot 03_live 5
tapf 70 97; shot 04_message 5
tapf 90 97; shot 05_me 6
swipeup;    shot 05b_me_scrolled 3
# nav artwork close-up: crop happens on the controller from 05_me

say "routes by deep link"
for r in wallet vip cp level backpack guild agency tasks search; do
  open "/$r"; shot "10_$r" 5
done

say "gift studio + engine"
open "/gift-studio"; shot 20_gift_studio 6
tapf 22 15; shot 21_crown 3
open "/gift-studio"; tapf 58 15; shot 22_angel 3
open "/gift-studio"; tapf 24 20; shot 23_big 3
open "/gift-studio"; tapf 60 20; shot 24_combo 3
open "/gift-studio"; tapf 25 25; shot 25_multi 3
open "/gift-studio"; tapf 62 25; shot 26_entrance 3

say "voice room"
open "/room/1"; shot 30_room 8
# deterministic decorative-overlay check (QA build only)
open "/gift-studio"; sleep 2   # leave the room so the next deep link is a fresh route
open "/room/1?demoBanner=1"; shot 34_room_banner 7
tapf 95 95;     shot 31_gift_panel 4
tapf 20 45;     shot 32_gift_selected 2
tapf 88 92;     shot 33_room_gift_sent 3

say "stop screenrecord"
wait $REC_PID 2>/dev/null
sleep 3
adb pull "/sdcard/seait_$RUN_ID.mp4" "$RUN_DIR/video/" >>"$LOG" 2>&1
adb shell rm -f "/sdcard/seait_$RUN_ID.mp4" >>"$LOG" 2>&1
say "video: $(ls -la "$RUN_DIR/video/" 2>/dev/null | tail -1)"

# ── diagnostics ─────────────────────────────────────────────────────
say "collecting diagnostics"
adb logcat -d > "$RUN_DIR/logs/logcat_full.log" 2>&1
grep -iE "flutter|seait|libpag|svga|UNKNOWN-GIFT|Exception|FATAL|SocketException" \
  "$RUN_DIR/logs/logcat_full.log" | tail -400 > "$RUN_DIR/logs/logcat_app.log" 2>&1
adb shell dumpsys activity activities > "$RUN_DIR/logs/dumpsys_activities.log" 2>&1
adb shell dumpsys window displays  > "$RUN_DIR/logs/dumpsys_window.log" 2>&1
adb shell dumpsys meminfo "$PKG"   > "$RUN_DIR/logs/dumpsys_meminfo.log" 2>&1
say "crashes=$(grep -icE 'SIGABRT|FATAL EXCEPTION' "$RUN_DIR/logs/logcat_full.log")"
say "shots=$(ls "$RUN_DIR/shots" | wc -l)"

# ── ship back (named by run id: never overwrites) ───────────────────
rm -f "$APK"                      # don't ship the APK back
TGZ="$RUNS/$RUN_ID.tgz"
tar czf "$TGZ" -C "$RUNS" "$RUN_ID" >>"$LOG" 2>&1
say "shipping $TGZ ($(stat -c%s "$TGZ") bytes)"
scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 "$TGZ" "root@$CTRL:/root/seait-runs/" >>"$LOG" 2>&1
say "DONE"
