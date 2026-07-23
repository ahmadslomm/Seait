#!/bin/bash
# Controller-side launcher. Assigns the run ID, refuses to start while another
# run is in flight, kicks off the worker driver, and waits for that run's
# artefact specifically (so late finishers can never be mistaken for the new one).
set -u
RUNS=/root/seait-runs
mkdir -p "$RUNS"
INFLIGHT="$RUNS/.inflight"

RUN_ID="${1:-r$(date +%Y%m%d-%H%M%S)}"

if [ -f "$INFLIGHT" ]; then
  prev=$(cat "$INFLIGHT")
  if [ -n "$prev" ] && [ ! -f "$RUNS/$prev.tgz" ]; then
    echo "REFUSED: run $prev still in flight (no $RUNS/$prev.tgz yet)"
    exit 2
  fi
fi
echo "$RUN_ID" > "$INFLIGHT"

echo "[$RUN_ID] launching on worker"
timeout 1800 ssh -o ConnectTimeout=30 -o ServerAliveInterval=15 -o BatchMode=yes worker \
  "curl -sS -m 300 -o /root/run_seait.sh http://140.82.32.124:8078/run_seait.sh \
   && chmod +x /root/run_seait.sh \
   && (setsid nohup /root/run_seait.sh $RUN_ID > /root/boot_$RUN_ID.log 2>&1 < /dev/null &) \
   ; sleep 2; echo LAUNCHED $RUN_ID" 2>&1 | tail -2

echo "[$RUN_ID] waiting for $RUNS/$RUN_ID.tgz"
for i in $(seq 1 240); do
  [ -f "$RUNS/$RUN_ID.tgz" ] && break
  sleep 5
done

if [ -f "$RUNS/$RUN_ID.tgz" ]; then
  tar xzf "$RUNS/$RUN_ID.tgz" -C "$RUNS"
  echo "[$RUN_ID] ARRIVED $(stat -c%s "$RUNS/$RUN_ID.tgz") bytes -> $RUNS/$RUN_ID/"
  echo "[$RUN_ID] shots: $(ls "$RUNS/$RUN_ID/shots" 2>/dev/null | wc -l)"
else
  echo "[$RUN_ID] TIMEOUT — no artefact"
  exit 1
fi
