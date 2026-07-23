#!/usr/bin/env node
/**
 * Drives room state from the socket while the Flutter app sits in the room, so
 * we can observe what the client actually asks Agora to do.
 *
 * Why this exists: the lab has ONE emulator, so the app can only ever be one
 * participant. Items 3 and 4 of the RTC verification list ("owner mute/unmute
 * affects the real stream", "seat take/leave changes the publisher role") are
 * about the app REACTING to server state — they do not need a second listener,
 * they need someone to change the state. That is this script.
 *
 * It connects as the app's own uid (a second session of the same account, as if
 * the user were on another device), which makes it staff for room 1 and lets it
 * move the seat the app occupies. Every transition it drives should produce a
 * matching `[rtc] setPublisher(...)` / `[rtc] setMuted(...)` line in logcat.
 *
 * Sequence, once the app is seen entering:
 *   sit seat 3      -> setPublisher(true)
 *   mic muted       -> setMuted(true)
 *   mic unmuted     -> setMuted(false)
 *   stand up        -> setPublisher(false)
 *
 * Usage: node test/rtc_state_driver.js [wsBase] [rid] [uid] [seat] [waitSecs]
 */
const { io } = require('socket.io-client');

const WS   = process.argv[2] || 'http://127.0.0.1:8077';
const RID  = Number(process.argv[3] || 1);
const UID  = Number(process.argv[4] || 1278472);
const SEAT = Number(process.argv[5] || 3);
const WAIT = Number(process.argv[6] || 900);

const t0 = Date.now();
const log = (...a) =>
  console.log(`${new Date().toISOString().slice(11, 19)} +${String(
    ((Date.now() - t0) / 1000).toFixed(1)).padStart(6)}s`, ...a);

const s = io(`${WS}/room`, { transports: ['websocket'], forceNew: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Our own room_join echoes a user_enter back to us. Ignore anything in the
// settle window so we only trigger on the APP arriving.
const SETTLE_MS = 4000;
let joinedAt = 0;
let fired = false;

s.on('connect', () => {
  log(`connected; joining room ${RID} as uid ${UID} (driver session)`);
  s.emit('room_join', { rid: RID, uid: UID, seatCount: 10 });
  joinedAt = Date.now();
});

s.on('user_enter', d => {
  if (Number(d.uid) !== UID) return;
  if (Date.now() - joinedAt < SETTLE_MS) return log('ignoring own join echo');
  if (fired) return;
  fired = true;
  log('APP DETECTED in room — starting transition sequence');
  run().catch(e => log('driver error', e));
});

// Echo back what the server broadcasts, so the driver log can be lined up
// against logcat when reading the results.
s.on('seat_update', d =>
  log(`<- seat_update seat=${d.seatNo} uid=${d.uid ?? 'null'} mic=${d.micState}`));
s.on('mic_status', d =>
  log(`<- mic_status seat=${d.seatNo} uid=${d.uid ?? 'null'} mic=${d.micState}`));
s.on('action_denied', d => log('<- action_denied', JSON.stringify(d)));

async function step(label, event, payload, waitMs = 6000) {
  log(`STEP ${label}`);
  s.emit(event, payload);
  await sleep(waitMs);
}

async function run() {
  // Give the room screen a moment to finish its own RTC join first, otherwise
  // the transitions land before there is an engine to act on.
  await sleep(6000);

  await step('1/4 sit on seat ' + SEAT + ' -> expect setPublisher(true)',
    'seat_update', { rid: RID, uid: UID, seatNo: SEAT });

  await step('2/4 mute that seat -> expect setMuted(true)',
    'mic_status', { rid: RID, uid: UID, seatNo: SEAT, micState: 1 });

  await step('3/4 unmute that seat -> expect setMuted(false)',
    'mic_status', { rid: RID, uid: UID, seatNo: SEAT, micState: 0 });

  await step('4/4 stand up -> expect setPublisher(false)',
    'seat_leave', { rid: RID, uid: UID, targetUid: UID });

  log('sequence complete — leaving driver connected until timeout');
}

setTimeout(() => { log('done'); s.close(); process.exit(0); }, WAIT * 1000);
