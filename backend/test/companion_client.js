#!/usr/bin/env node
/**
 * A long-lived second participant for room verification.
 *
 * The lab has one emulator, so the Flutter app can only ever be ONE client. This
 * script supplies the other side: it joins the room as a different uid, takes a
 * seat, chats, and toggles `speaking` on a cycle — so an emulator screenshot
 * captures a genuinely remote occupant, a remote chat line, and the remote
 * speaking halo.
 *
 * It exercises the socket contracts only. It does not join Agora, so it proves
 * the halo/roster/chat paths, not audio.
 *
 * Usage: node test/companion_client.js [wsBase] [rid] [uid] [seat] [seconds]
 */
const { io } = require('socket.io-client');

const WS      = process.argv[2] || 'http://127.0.0.1:8077';
const RID     = Number(process.argv[3] || 1);
const UID     = Number(process.argv[4] || 999001);
const SEAT    = Number(process.argv[5] || 2);
const SECONDS = Number(process.argv[6] || 600);

const s = io(`${WS}/room`, { transports: ['websocket'], forceNew: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

s.on('connect', () => {
  log(`connected; joining room ${RID} as uid ${UID}`);
  s.emit('room_join', { rid: RID, uid: UID, seatCount: 10 });
  setTimeout(() => {
    s.emit('seat_update', { rid: RID, uid: UID, seatNo: SEAT });
    log(`took seat ${SEAT}`);
  }, 800);
  setTimeout(() => {
    s.emit('chat', { rid: RID, uid: UID, text: 'hello from the second client' });
    log('sent chat');
  }, 1600);
});

s.on('role', d => { if (Number(d.uid) === UID) log('role =', d.role); });
s.on('action_denied', d => log('DENIED', d.action, d.reason));
s.on('user_kicked', d => { if (Number(d.uid) === UID) { log('kicked'); process.exit(0); } });

// Speaking cycle: 2s on, 2s off — long enough for a screenshot to land on "on".
let speaking = false;
const cycle = setInterval(() => {
  speaking = !speaking;
  s.emit('speaking', { rid: RID, seatNo: SEAT, speaking });
}, 2000);

// Periodic chat so the feed is never empty when a screenshot is taken.
let n = 0;
const chatter = setInterval(() => {
  s.emit('chat', { rid: RID, uid: UID, text: `remote message #${++n}` });
}, 15000);

setTimeout(() => {
  clearInterval(cycle); clearInterval(chatter);
  s.emit('speaking', { rid: RID, seatNo: SEAT, speaking: false });
  s.emit('room_leave', { rid: RID, uid: UID });
  log('done, leaving');
  setTimeout(() => process.exit(0), 300);
}, SECONDS * 1000);
