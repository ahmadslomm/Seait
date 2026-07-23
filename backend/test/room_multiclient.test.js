#!/usr/bin/env node
/**
 * Multi-client acceptance test for the Room Engine.
 *
 * Drives two real socket.io clients against a running backend:
 *   A = room owner  (Room.owner_uid)
 *   B = ordinary user
 *
 * Covers presence, seats, chat, mic request/approve/reject, moderation and —
 * importantly — that a plain user is REFUSED the staff-only actions.
 *
 * Usage:  node test/room_multiclient.test.js [wsBase] [rid]
 * Exits non-zero on the first failed assertion.
 */
const { io } = require('socket.io-client');

const WS = process.argv[2] || 'http://127.0.0.1:8077';
const RID = Number(process.argv[3] || 1);
const A_UID = 1278472;          // seeded owner of every sample room
const B_UID = 999001;           // arbitrary second user
const T = 4000;                 // per-await timeout

let pass = 0, fail = 0;
const ok = (n, extra = '') => { pass++; console.log(`  ✓ ${n}${extra ? '  ' + extra : ''}`); };
const bad = (n, e) => { fail++; console.log(`  ✗ ${n}\n      ${e}`); };

/** Resolve on the next matching event, or reject after T ms. */
function next(sock, ev, match = () => true, t = T) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => { sock.off(ev, h); rej(new Error(`timeout waiting for '${ev}'`)); }, t);
    const h = (d) => { if (!match(d)) return; clearTimeout(timer); sock.off(ev, h); res(d); };
    sock.on(ev, h);
  });
}
/** Assert the event does NOT arrive within t ms. */
function absent(sock, ev, t = 800) {
  return new Promise((res, rej) => {
    const h = (d) => { clearTimeout(timer); sock.off(ev, h); rej(new Error(`unexpected '${ev}': ${JSON.stringify(d)}`)); };
    const timer = setTimeout(() => { sock.off(ev, h); res(); }, t);
    sock.on(ev, h);
  });
}
async function step(name, fn) {
  try { const extra = await fn(); ok(name, extra); }
  catch (e) { bad(name, e.message); }
}
const connect = () => new Promise((res, rej) => {
  const s = io(`${WS}/room`, { transports: ['websocket'], forceNew: true });
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
  setTimeout(() => rej(new Error('connect timeout')), T);
});
const seatOf = (state, uid) => (state.seats || []).find(s => s.uid === uid);

(async () => {
  console.log(`Room engine multi-client test -> ${WS} room ${RID}`);
  const A = await connect();
  const B = await connect();

  // ── presence ────────────────────────────────────────────────────
  await step('A joins and is recognised as owner', async () => {
    const st = next(A, 'room_state');
    const role = next(A, 'role', d => d.uid === A_UID);
    A.emit('room_join', { rid: RID, uid: A_UID, seatCount: 10 });
    const s = await st; const r = await role;
    if (r.role !== 'owner') throw new Error(`expected owner, got ${r.role} (ownerUid=${s.ownerUid})`);
    return `ownerUid=${s.ownerUid} seats=${s.seats.length}`;
  });

  await step('B joins as user and A sees user_enter with a profile', async () => {
    const enterOnA = next(A, 'user_enter', d => Number(d.uid) === B_UID);
    const roleB = next(B, 'role', d => d.uid === B_UID);
    B.emit('room_join', { rid: RID, uid: B_UID, seatCount: 10 });
    const e = await enterOnA; const r = await roleB;
    if (r.role !== 'user') throw new Error(`expected user, got ${r.role}`);
    if (!('noble_level' in e)) throw new Error('user_enter carried no profile fields');
    return `nick=${e.nick} noble=${e.noble_level}`;
  });

  await step('users_update lists both with roles', async () => {
    const p = next(A, 'users_update', d => d.count >= 2);
    A.emit('users_list', { rid: RID });
    const u = await p;
    const roles = Object.fromEntries(u.users.map(x => [x.uid, x.role]));
    if (roles[A_UID] !== 'owner' || roles[B_UID] !== 'user') throw new Error(JSON.stringify(roles));
    return `count=${u.count}`;
  });

  // ── seats ───────────────────────────────────────────────────────
  await step('B takes seat 3, both clients see it', async () => {
    const onA = next(A, 'seat_update', d => d.seatNo === 3 && d.uid === B_UID);
    const onB = next(B, 'seat_update', d => d.seatNo === 3 && d.uid === B_UID);
    B.emit('seat_update', { rid: RID, uid: B_UID, seatNo: 3 });
    await onA; await onB;
  });

  await step('B leaves the seat', async () => {
    const onA = next(A, 'seat_update', d => d.seatNo === 3 && d.uid === null);
    B.emit('seat_leave', { rid: RID, uid: B_UID });
    await onA;
  });

  // ── chat both ways ──────────────────────────────────────────────
  await step('A -> B chat carries nick and role', async () => {
    const onB = next(B, 'chat', d => Number(d.uid) === A_UID);
    A.emit('chat', { rid: RID, uid: A_UID, text: 'hello from owner' });
    const m = await onB;
    if (m.text !== 'hello from owner') throw new Error('text mismatch');
    if (m.role !== 'owner') throw new Error(`role=${m.role}`);
    return `nick=${m.nick}`;
  });

  await step('B -> A chat', async () => {
    const onA = next(A, 'chat', d => Number(d.uid) === B_UID);
    B.emit('chat', { rid: RID, uid: B_UID, text: 'hi owner' });
    const m = await onA;
    if (m.text !== 'hi owner') throw new Error('text mismatch');
  });

  // ── mic request / approve / reject ──────────────────────────────
  await step('B requests a mic, A receives it', async () => {
    const onA = next(A, 'mic_request', d => Number(d.uid) === B_UID);
    B.emit('mic_request', { rid: RID, uid: B_UID });
    await onA;
  });

  await step('A approves -> B is seated', async () => {
    const approved = next(B, 'mic_approved', d => Number(d.uid) === B_UID);
    A.emit('mic_approve', { rid: RID, uid: A_UID, targetUid: B_UID, seatNo: 4 });
    const a = await approved;
    if (a.seatNo !== 4) throw new Error(`seated at ${a.seatNo}`);
    return `seat=${a.seatNo}`;
  });

  await step('A rejects a later request', async () => {
    B.emit('mic_request', { rid: RID, uid: B_UID });
    const rejected = next(B, 'mic_rejected', d => Number(d.uid) === B_UID);
    A.emit('mic_reject', { rid: RID, uid: A_UID, targetUid: B_UID });
    await rejected;
  });

  // ── permission refusals for a plain user ────────────────────────
  await step('B cannot kick (owner_only)', async () => {
    const denied = next(B, 'action_denied', d => d.action === 'kick_user');
    B.emit('kick_user', { rid: RID, uid: B_UID, targetUid: A_UID });
    const d = await denied;
    if (d.reason !== 'owner_only') throw new Error(d.reason);
    return d.reason;
  });

  await step('B cannot lock a seat (not_permitted)', async () => {
    const denied = next(B, 'action_denied', d => d.action === 'seat_lock');
    B.emit('seat_lock', { rid: RID, uid: B_UID, seatNo: 7, lock: 1 });
    const d = await denied;
    if (d.reason !== 'not_permitted') throw new Error(d.reason);
    return d.reason;
  });

  await step('B cannot mute others (not_permitted)', async () => {
    const denied = next(B, 'action_denied', d => d.action === 'mute_user');
    B.emit('mute_user', { rid: RID, uid: B_UID, targetUid: A_UID, mute: 1 });
    const d = await denied;
    if (d.reason !== 'not_permitted') throw new Error(d.reason);
    return d.reason;
  });

  await step('B cannot grant admin (owner_only)', async () => {
    const denied = next(B, 'action_denied', d => d.action === 'set_admin');
    B.emit('set_admin', { rid: RID, uid: B_UID, targetUid: B_UID, admin: 1 });
    const d = await denied;
    if (d.reason !== 'owner_only') throw new Error(d.reason);
    return d.reason;
  });

  // ── mute enforcement ────────────────────────────────────────────
  await step('A mutes B; B chat is refused and never broadcasts', async () => {
    const muted = next(A, 'user_muted', d => Number(d.uid) === B_UID && d.muted === true);
    A.emit('mute_user', { rid: RID, uid: A_UID, targetUid: B_UID, mute: 1 });
    await muted;
    const denied = next(B, 'action_denied', d => d.action === 'chat');
    const silence = absent(A, 'chat');           // A must NOT receive it
    B.emit('chat', { rid: RID, uid: B_UID, text: 'should not appear' });
    const d = await denied;
    await silence;
    if (d.reason !== 'muted') throw new Error(d.reason);
  });

  await step('A unmutes B; chat flows again', async () => {
    A.emit('mute_user', { rid: RID, uid: A_UID, targetUid: B_UID, mute: 0 });
    await next(A, 'user_muted', d => Number(d.uid) === B_UID && d.muted === false);
    const onA = next(A, 'chat', d => Number(d.uid) === B_UID);
    B.emit('chat', { rid: RID, uid: B_UID, text: 'back again' });
    const m = await onA;
    if (m.text !== 'back again') throw new Error('text mismatch');
  });

  // ── seat lock enforcement ───────────────────────────────────────
  await step('A locks seat 6; B is refused (seat_locked)', async () => {
    const locked = next(A, 'seat_update', d => d.seatNo === 6 && d.lock === 1);
    A.emit('seat_lock', { rid: RID, uid: A_UID, seatNo: 6, lock: 1 });
    await locked;
    const denied = next(B, 'action_denied', d => d.action === 'seat_update');
    B.emit('seat_update', { rid: RID, uid: B_UID, seatNo: 6 });
    const d = await denied;
    if (d.reason !== 'seat_locked') throw new Error(d.reason);
    return d.reason;
  });

  // ── kick ────────────────────────────────────────────────────────
  await step('A kicks B; B is notified and removed from the roster', async () => {
    const kicked = next(B, 'user_kicked', d => Number(d.uid) === B_UID);
    const left = next(A, 'user_leave', d => Number(d.uid) === B_UID);
    A.emit('kick_user', { rid: RID, uid: A_UID, targetUid: B_UID });
    await kicked; await left;
    const u = await next(A, 'users_update', () => true).catch(() => null);
    if (u && u.users.some(x => x.uid === B_UID)) throw new Error('B still listed after kick');
  });


  // ── contracts that drive the RTC layer ──────────────────────────
  // Real audio needs Agora credentials + two mic'd devices, which this lab does
  // not have. What IS verifiable here is the state plumbing the client turns
  // into Agora calls: these events are what trigger rtc.setMuted /
  // rtc.setPublisher / the speaking halo. If these contracts hold, the RTC layer
  // is being fed correctly even though the audio itself is unproven.
  console.log('\n  -- RTC state contracts --');

  await step('seat take emits seat_update for B -> client calls setPublisher(true)', async () => {
    const onB = next(B, 'seat_update', d => d.seatNo === 2 && d.uid === B_UID);
    B.emit('seat_update', { rid: RID, uid: B_UID, seatNo: 2 });
    const s = await onB;
    if (!s.profile) throw new Error('seat_update carried no profile');
    return `seat=${s.seatNo}`;
  });

  await step('owner mute of B emits mic_status(1) on B\'s seat -> setMuted(true)', async () => {
    const onB = next(B, 'mic_status', d => d.seatNo === 2 && d.micState === 1);
    A.emit('mic_status', { rid: RID, uid: A_UID, seatNo: 2, micState: 1 });
    const s = await onB;
    if (s.uid !== B_UID) throw new Error(`micState applied to uid ${s.uid}`);
    return 'micState=1';
  });

  await step('owner unmute emits mic_status(0) -> setMuted(false)', async () => {
    const onB = next(B, 'mic_status', d => d.seatNo === 2 && d.micState === 0);
    A.emit('mic_status', { rid: RID, uid: A_UID, seatNo: 2, micState: 0 });
    await onB;
    return 'micState=0';
  });

  await step('B self-mute is allowed (own seat)', async () => {
    const onA = next(A, 'mic_status', d => d.seatNo === 2 && d.micState === 1);
    B.emit('mic_status', { rid: RID, uid: B_UID, seatNo: 2, micState: 1 });
    await onA;
    B.emit('mic_status', { rid: RID, uid: B_UID, seatNo: 2, micState: 0 });
  });

  await step('speaking from B reaches A (drives the remote halo)', async () => {
    const onA = next(A, 'speaking', d => d.seatNo === 2 && d.speaking === true);
    B.emit('speaking', { rid: RID, seatNo: 2, speaking: true });
    await onA;
    const off = next(A, 'speaking', d => d.seatNo === 2 && d.speaking === false);
    B.emit('speaking', { rid: RID, seatNo: 2, speaking: false });
    await off;
    return 'on+off propagated';
  });

  await step('seat leave emits vacated seat -> client calls setPublisher(false)', async () => {
    const onA = next(A, 'seat_update', d => d.seatNo === 2 && d.uid === null);
    B.emit('seat_leave', { rid: RID, uid: B_UID });
    await onA;
  });

  A.close(); B.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('harness error:', e); process.exit(2); });
