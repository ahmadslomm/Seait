#!/usr/bin/env node
/**
 * A REAL second Agora participant, so audio can be tested with one emulator.
 *
 * The lab has a single emulator and the companion client is socket-only, which
 * left RTC items 2 and 5 — "real two-way audio" and "the speaking halo appears
 * on a remote client" — unprovable. This closes that gap by joining the same
 * Agora channel from headless Chromium using the Agora Web SDK, with Chrome's
 * fake capture device supplying a genuine tone instead of a microphone.
 *
 * It earns its publisher token the same way any client must: it joins the room
 * over the socket and TAKES A SEAT first, then asks the gateway for a token.
 * The server grants publisher only because of that seat, so this exercises the
 * real permission path rather than bypassing it.
 *
 * What each side then proves:
 *   web  -> "user-published" from the app's uid   = the emulator is publishing
 *   web  -> remote volume > 0                     = the emulator's audio is audible
 *   app  -> onUserJoined / volume for this uid    = remote audio reaches the app
 *   app  -> `speaking` relayed over the socket    = the halo fires from REAL audio
 *
 * The page reports through /log on the local server rather than the browser
 * console, because headless console capture without a CDP client is unreliable.
 *
 * Usage: node test/web_peer.js [base] [rid] [uid] [seat] [seconds]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createHash } = require('crypto');
const { io } = require('socket.io-client');

const BASE    = process.argv[2] || 'http://127.0.0.1:8077';
const RID     = Number(process.argv[3] || 1);
const UID     = Number(process.argv[4] || 999100);
const SEAT    = Number(process.argv[5] || 5);
const SECONDS = Number(process.argv[6] || 420);
const PORT    = Number(process.env.PEER_PORT || 8493);
const SDK     = process.env.AGORA_SDK ||
  '/tmp/claude-0/-root/f29d2a24-6aa4-4b85-8baf-71f01433087f/scratchpad/peer/AgoraRTC.js';

const t0 = Date.now();
const log = (...a) => console.log(
  `${new Date().toISOString().slice(11, 19)} +${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`, ...a);

// ── gateway cipher (same as the other tests) ────────────────────────
const KEY = Buffer.from(createHash('md5').update('com.waig.nalo').digest('hex'));
const xor = (d, k) => { const o = Buffer.allocUnsafe(d.length); for (let i = 0; i < d.length; i++) o[i] = d[i] ^ k[i % k.length]; return o; };
const enc = j => xor(Buffer.from(j, 'utf8'), KEY).toString('base64');
const dec = b => { let s = b.replace(/_/g, '/'); while (s.length % 4) s += '='; return xor(Buffer.from(s, 'base64'), KEY).toString('utf8'); };

function call(action, params) {
  return new Promise((res, rej) => {
    const p = { action, token: '', uid: params.uid, _login_uid: params.uid, ...params };
    const body = 'app_id=com.waig.nalo&http_body=' + enc(JSON.stringify(p));
    const u = new URL(BASE);
    const r = http.request({ host: u.hostname, port: u.port, path: '/api.php', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      x => { let d = ''; x.on('data', c => d += c); x.on('end', () => {
        let t = d.trim(); if (t.startsWith('QxZ')) t = dec(t);
        try { res(JSON.parse(t).response_data); } catch (e) { rej(new Error('bad response: ' + t.slice(0, 120))); }
      }); });
    r.on('error', rej); r.write(body); r.end();
  });
}

const page = creds => `<!doctype html><meta charset="utf-8"><title>peer</title>
<script src="/AgoraRTC.js"></script>
<script>
const C = ${JSON.stringify(creds)};
const send = m => fetch('/log', {method:'POST', body:m}).catch(()=>{});
window.onerror = e => send('PAGE ERROR ' + e);
(async () => {
  try {
    AgoraRTC.setLogLevel(3);
    const c = AgoraRTC.createClient({mode:'live', codec:'vp8'});
    await c.setClientRole('host');

    c.on('user-published', async (u, kind) => {
      send('user-published uid=' + u.uid + ' kind=' + kind);
      if (kind === 'audio') {
        await c.subscribe(u, 'audio');
        send('SUBSCRIBED to audio of uid=' + u.uid);
      }
    });
    c.on('user-joined', u => send('user-joined uid=' + u.uid));
    c.on('user-left',   u => send('user-left uid=' + u.uid));

    // Volume of every participant, ours and theirs. A non-zero level for the
    // app's uid is proof its microphone track carries real audio.
    c.enableAudioVolumeIndicator();
    c.on('volume-indicator', vs => {
      const loud = vs.filter(v => v.level > 3);
      if (loud.length) send('volume ' + loud.map(v => v.uid + '=' + Math.round(v.level)).join(' '));
    });

    const uid = await c.join(C.appId, C.channel, C.token || null, C.uid);
    send('JOINED channel=' + C.channel + ' uid=' + uid);

    // Chrome's fake capture device supplies a real tone, so this publishes
    // genuine audio rather than silence.
    const mic = await AgoraRTC.createMicrophoneAudioTrack();
    await c.publish([mic]);
    send('PUBLISHED local audio track');
  } catch (e) {
    send('FAILED ' + (e && e.message ? e.message : e));
  }
})();
</script>`;

(async () => {
  log(`web peer: room ${RID} uid ${UID} seat ${SEAT} -> ${BASE}`);
  if (!fs.existsSync(SDK)) { log('missing Agora Web SDK at ' + SDK); process.exit(1); }

  // 1. Join the room and take a seat, so the server will mint a PUBLISHER token.
  const s = io(`${BASE}/room`, { transports: ['websocket'], forceNew: true });
  await new Promise(r => s.on('connect', r));
  s.emit('room_join', { rid: RID, uid: UID, seatCount: 10 });
  await new Promise(r => setTimeout(r, 600));
  s.emit('seat_update', { rid: RID, uid: UID, seatNo: SEAT });
  await new Promise(r => setTimeout(r, 600));
  log(`joined room and took seat ${SEAT}`);

  // 2. Ask for credentials through the real gateway.
  const creds = await call('rtc.getToken', { rid: RID, uid: UID });
  log(`token role=${creds.role} channel=${creds.channel} token=${creds.token ? creds.token.slice(0, 12) + '…' : 'none'}`);
  if (creds.role !== 'publisher') {
    log('server refused publisher — the seat did not register; aborting');
    process.exit(1);
  }

  // 3. Serve the page from localhost (a secure context, so getUserMedia works).
  const html = page(creds);
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/log') {
      let b = ''; req.on('data', c => b += c);
      return req.on('end', () => { log('[web]', b); res.end('ok'); });
    }
    if (req.url === '/AgoraRTC.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return fs.createReadStream(SDK).pipe(res);
    }
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  log(`serving peer page on http://127.0.0.1:${PORT}`);

  // 4. Headless Chromium with a fake capture device instead of a microphone.
  const bin = ['/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/chromium']
    .find(p => fs.existsSync(p));
  const profile = path.join('/tmp', 'agora-peer-profile-' + process.pid);
  const chrome = spawn(bin, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + profile,
    `http://127.0.0.1:${PORT}/`,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', d => {
    const t = String(d).trim();
    if (/error|fail/i.test(t) && !/GPU|gpu_|Vulkan|dbus|DEPRECATED/i.test(t)) log('[chrome]', t.slice(0, 200));
  });
  log(`launched ${bin}`);

  const stop = () => {
    log('shutting down');
    try { chrome.kill('SIGKILL'); } catch (_) {}
    try { s.emit('seat_leave', { rid: RID, uid: UID, targetUid: UID }); s.close(); } catch (_) {}
    try { srv.close(); } catch (_) {}
    fs.rmSync(profile, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  setTimeout(stop, SECONDS * 1000);
})();
