import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

const LAYOUTS = [5, 10, 15, 21, 30];

type Seat = {
  seatNo: number;
  uid: number | null;
  micState: number;   // 0 open, 1 muted
  lock: number;       // 0 open, 1 locked (nobody may sit)
  speaking?: boolean;
  charmValue?: number;
};

/** Cached public profile used to decorate every broadcast. */
type Profile = {
  uid: number; nick: string; avatar: string; avatarFrame: string;
  noble_level: number; wealthLv: number; charmLv: number; isAnchor: boolean;
};

type Role = 'owner' | 'admin' | 'user';

type Room = {
  rid: number;
  seatCount: number;
  ownerUid: number;
  seats: Seat[];
  members: Map<number, Profile>;   // everyone currently in the room
  admins: Set<number>;
  muted: Set<number>;              // text-muted by staff
  micRequests: Set<number>;        // listeners waiting for a seat
};

/**
 * Real-time room engine: presence, seats, mic, chat and moderation.
 *
 * Every broadcast carries the actor's public profile so clients can render the
 * name / VIP / badges without a second round-trip, and so entry effects know the
 * noble level. Permissions are enforced HERE — the client only ever asks.
 */
@WebSocketGateway({ cors: true, namespace: '/room' })
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private rooms = new Map<number, Room>();
  private profiles = new Map<number, Profile>();

  constructor(private prisma: PrismaService) {}

  // ── helpers ───────────────────────────────────────────────────────
  private async ensure(rid: number, n = 10): Promise<Room> {
    let r = this.rooms.get(rid);
    if (r) return r;
    const rec = await this.prisma.room.findUnique({ where: { rid } }).catch(() => null);
    const count = LAYOUTS.includes(rec?.seatCount ?? n) ? (rec?.seatCount ?? n) : 10;
    r = {
      rid,
      seatCount: count,
      ownerUid: rec?.owner_uid ?? 0,
      seats: Array.from({ length: count }, (_, i) => ({ seatNo: i, uid: null, micState: 0, lock: 0 })),
      members: new Map(),
      admins: new Set(),
      muted: new Set(),
      micRequests: new Set(),
    };
    // room staff from the DB (role != 'member')
    const staff = await this.prisma.roomMember.findMany({ where: { rid } }).catch(() => []);
    for (const m of staff) if (m.role && m.role !== 'member') r.admins.add(m.uid);
    this.rooms.set(rid, r);
    return r;
  }

  private async profile(uid: number): Promise<Profile> {
    const hit = this.profiles.get(uid);
    if (hit) return hit;
    const u = await this.prisma.user.findUnique({ where: { uid } }).catch(() => null);
    const w = await this.prisma.wealth.findUnique({ where: { uid } }).catch(() => null);
    const p: Profile = {
      uid,
      nick: u?.nick ?? `U${uid}`,
      avatar: u?.avatar ?? '',
      avatarFrame: u?.avatarFrame ?? '',
      noble_level: u?.noble_level ?? 0,
      wealthLv: w?.wealthLv ?? 0,
      charmLv: w?.charmLv ?? 0,
      isAnchor: u?.isAnchor ?? false,
    };
    this.profiles.set(uid, p);
    return p;
  }

  /** Is this uid currently on a seat?
   *
   *  The in-memory room state is the source of truth for seats — sitting and
   *  standing are socket events and are deliberately not written to the DB on
   *  every transition. Anything that needs to know "may this user speak" must
   *  ask here; reading prisma.seat sees a stale table and answers no. */
  isSeated(rid: number, uid: number): boolean {
    const r = this.rooms.get(rid);
    return !!r && r.seats.some(s => s.uid === uid);
  }

  private roleOf(r: Room, uid: number): Role {
    if (uid === r.ownerUid) return 'owner';
    if (r.admins.has(uid)) return 'admin';
    return 'user';
  }

  /** owner > admin > user. Staff means owner or admin. */
  private isStaff(r: Room, uid: number) { return this.roleOf(r, uid) !== 'user'; }

  private rm(rid: number) { return `room_${rid}`; }

  private deny(c: Socket, action: string, reason: string) {
    c.emit('action_denied', { action, reason });
  }

  private async state(r: Room) {
    return {
      rid: r.rid,
      seatCount: r.seatCount,
      ownerUid: r.ownerUid,
      // Decorate occupied seats with their profile. seat_update already does
      // this, but room_state did not — so a client joining an ALREADY POPULATED
      // room rendered occupied seats as empty "No.N" placeholders.
      seats: await Promise.all(r.seats.map(async s =>
        s.uid ? { ...s, profile: await this.profile(s.uid) } : s)),
      members: [...r.members.values()],
      admins: [...r.admins],
      muted: [...r.muted],
    };
  }

  private broadcastUsers(r: Room) {
    this.server.to(this.rm(r.rid)).emit('users_update', {
      count: r.members.size,
      users: [...r.members.values()].map(p => ({ ...p, role: this.roleOf(r, p.uid) })),
    });
  }

  // ── presence ──────────────────────────────────────────────────────
  @SubscribeMessage('room_join')
  async onJoin(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid);
    if (!rid || !uid) return;
    const r = await this.ensure(rid, Number(d?.seatCount) || 10);
    c.join(this.rm(rid));
    (c.data as any) = { rid, uid };

    const p = await this.profile(uid);
    r.members.set(uid, p);

    c.emit('room_state', await this.state(r));
    c.emit('role', { uid, role: this.roleOf(r, uid) });
    // Entry effect: clients gate the animation on noble_level.
    this.server.to(this.rm(rid)).emit('user_enter', { ...p, role: this.roleOf(r, uid) });
    this.broadcastUsers(r);
  }

  @SubscribeMessage('room_leave')
  async onLeave(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    await this.exit(Number(d?.rid), Number(d?.uid));
    c.leave(this.rm(Number(d?.rid)));
  }

  private async exit(rid: number, uid: number) {
    const r = this.rooms.get(rid);
    if (!r || !uid) return;
    r.members.delete(uid);
    for (const s of r.seats) if (s.uid === uid) { s.uid = null; s.micState = 0; this.server.to(this.rm(rid)).emit('seat_update', s); }
    this.server.to(this.rm(rid)).emit('user_leave', { uid });
    this.broadcastUsers(r);
  }

  @SubscribeMessage('users_list')
  async onUsers(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const r = await this.ensure(Number(d?.rid));
    c.emit('users_update', {
      count: r.members.size,
      users: [...r.members.values()].map(p => ({ ...p, role: this.roleOf(r, p.uid) })),
    });
  }

  // ── seats ─────────────────────────────────────────────────────────
  /** Sit down. Refused when the seat is taken or locked (staff bypass lock). */
  @SubscribeMessage('seat_update')
  async onSeat(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), no = Number(d?.seatNo);
    const r = await this.ensure(rid);
    const s = r.seats[no];
    if (!s) return;
    if (s.uid && s.uid !== uid) return this.deny(c, 'seat_update', 'seat_taken');
    if (s.lock === 1 && !this.isStaff(r, uid)) return this.deny(c, 'seat_update', 'seat_locked');

    for (const x of r.seats) if (x.uid === uid && x.seatNo !== no) { x.uid = null; this.server.to(this.rm(rid)).emit('seat_update', x); }
    s.uid = uid;
    s.micState = 0;
    this.server.to(this.rm(rid)).emit('seat_update', { ...s, profile: await this.profile(uid) });
  }

  /** Stand up. Anyone may leave their own seat; staff may remove others. */
  @SubscribeMessage('seat_leave')
  async onSeatLeave(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), target = Number(d?.targetUid ?? d?.uid);
    const r = await this.ensure(rid);
    if (target !== uid && !this.isStaff(r, uid)) return this.deny(c, 'seat_leave', 'not_permitted');
    for (const s of r.seats) if (s.uid === target) { s.uid = null; s.micState = 0; this.server.to(this.rm(rid)).emit('seat_update', s); }
  }

  /** Move an occupant to another seat. Self-move always allowed; moving someone
   *  else is staff-only. */
  @SubscribeMessage('seat_move')
  async onSeatMove(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), target = Number(d?.targetUid ?? d?.uid), to = Number(d?.toSeat);
    const r = await this.ensure(rid);
    if (target !== uid && !this.isStaff(r, uid)) return this.deny(c, 'seat_move', 'not_permitted');
    const dest = r.seats[to];
    if (!dest) return;
    if (dest.uid) return this.deny(c, 'seat_move', 'seat_taken');
    if (dest.lock === 1 && !this.isStaff(r, uid)) return this.deny(c, 'seat_move', 'seat_locked');
    for (const s of r.seats) if (s.uid === target) { s.uid = null; this.server.to(this.rm(rid)).emit('seat_update', s); }
    dest.uid = target;
    dest.micState = 0;
    this.server.to(this.rm(rid)).emit('seat_update', { ...dest, profile: await this.profile(target) });
  }

  /** Lock / unlock a seat — staff only. */
  @SubscribeMessage('seat_lock')
  async onSeatLock(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), no = Number(d?.seatNo);
    const r = await this.ensure(rid);
    if (!this.isStaff(r, uid)) return this.deny(c, 'seat_lock', 'not_permitted');
    const s = r.seats[no];
    if (!s) return;
    s.lock = Number(d?.lock) === 1 ? 1 : 0;
    if (s.lock === 1) s.uid = null;
    this.server.to(this.rm(rid)).emit('seat_update', s);
  }

  // ── mic ───────────────────────────────────────────────────────────
  /** Mute/unmute. Self always allowed; muting someone else is staff-only. */
  @SubscribeMessage('mic_status')
  async onMic(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), no = Number(d?.seatNo);
    const r = await this.ensure(rid);
    const s = r.seats[no];
    if (!s) return;
    if (s.uid !== uid && !this.isStaff(r, uid)) return this.deny(c, 'mic_status', 'not_permitted');
    s.micState = Number(d?.micState) === 1 ? 1 : 0;
    this.server.to(this.rm(rid)).emit('mic_status', s);
  }

  @SubscribeMessage('speaking')
  onSpeak(@MessageBody() d: any) {
    const r = this.rooms.get(Number(d?.rid));
    const s = r?.seats[Number(d?.seatNo)];
    if (s) s.speaking = !!d?.speaking;
    this.server.to(this.rm(Number(d?.rid))).emit('speaking', d);
  }

  /** A listener asking for a mic; staff receive it as a request. */
  @SubscribeMessage('mic_request')
  async onMicRequest(@MessageBody() d: any) {
    const rid = Number(d?.rid), uid = Number(d?.uid);
    const r = await this.ensure(rid);
    const p = await this.profile(uid);
    r.micRequests.add(uid);
    this.server.to(this.rm(rid)).emit('mic_request', { ...p, seatNo: Number(d?.seatNo ?? -1) });
  }

  /** Staff grant a pending request: seats the user (first free seat if none given). */
  @SubscribeMessage('mic_approve')
  async onMicApprove(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), target = Number(d?.targetUid);
    const r = await this.ensure(rid);
    if (!this.isStaff(r, uid)) return this.deny(c, 'mic_approve', 'not_permitted');
    let no = Number(d?.seatNo);
    const free = r.seats.find(s => !s.uid && s.lock === 0);
    const seat = Number.isInteger(no) && no >= 0 ? r.seats[no] : free;
    if (!seat || seat.uid || seat.lock === 1) return this.deny(c, 'mic_approve', 'no_free_seat');
    for (const s of r.seats) if (s.uid === target) { s.uid = null; this.server.to(this.rm(rid)).emit('seat_update', s); }
    seat.uid = target;
    seat.micState = 0;
    r.micRequests.delete(target);
    this.server.to(this.rm(rid)).emit('mic_approved', { uid: target, seatNo: seat.seatNo });
    this.server.to(this.rm(rid)).emit('seat_update', { ...seat, profile: await this.profile(target) });
  }

  /** Staff decline a pending request. */
  @SubscribeMessage('mic_reject')
  async onMicReject(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), target = Number(d?.targetUid);
    const r = await this.ensure(rid);
    if (!this.isStaff(r, uid)) return this.deny(c, 'mic_reject', 'not_permitted');
    r.micRequests.delete(target);
    this.server.to(this.rm(rid)).emit('mic_rejected', { uid: target });
  }

  // ── chat ──────────────────────────────────────────────────────────
  @SubscribeMessage('chat')
  async onChat(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid);
    const text = `${d?.text ?? ''}`.slice(0, 500).trim();
    if (!rid || !uid || !text) return;
    const r = await this.ensure(rid);
    if (r.muted.has(uid)) return this.deny(c, 'chat', 'muted');
    const p = await this.profile(uid);
    this.server.to(this.rm(rid)).emit('chat', {
      ...p, role: this.roleOf(r, uid), text, ts: Date.now(),
    });
  }

  // ── moderation ────────────────────────────────────────────────────
  /** Text-mute a member. Owner and admin. */
  @SubscribeMessage('mute_user')
  async onMute(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), target = Number(d?.targetUid);
    const r = await this.ensure(rid);
    if (!this.isStaff(r, uid)) return this.deny(c, 'mute_user', 'not_permitted');
    if (this.roleOf(r, target) === 'owner') return this.deny(c, 'mute_user', 'cannot_target_owner');
    if (Number(d?.mute) === 1) r.muted.add(target); else r.muted.delete(target);
    this.server.to(this.rm(rid)).emit('user_muted', { uid: target, muted: r.muted.has(target) });
  }

  /** Kick a member out of the room. Owner only. */
  @SubscribeMessage('kick_user')
  async onKick(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), target = Number(d?.targetUid);
    const r = await this.ensure(rid);
    if (this.roleOf(r, uid) !== 'owner') return this.deny(c, 'kick_user', 'owner_only');
    this.server.to(this.rm(rid)).emit('user_kicked', { uid: target });
    await this.exit(rid, target);
  }

  /** Grant / revoke admin. Owner only. */
  @SubscribeMessage('set_admin')
  async onSetAdmin(@MessageBody() d: any, @ConnectedSocket() c: Socket) {
    const rid = Number(d?.rid), uid = Number(d?.uid), target = Number(d?.targetUid);
    const r = await this.ensure(rid);
    if (this.roleOf(r, uid) !== 'owner') return this.deny(c, 'set_admin', 'owner_only');
    if (Number(d?.admin) === 1) r.admins.add(target); else r.admins.delete(target);
    this.server.to(this.rm(rid)).emit('role', { uid: target, role: this.roleOf(r, target) });
    this.broadcastUsers(r);
  }

  handleDisconnect(c: Socket) {
    const { rid, uid } = (c.data as any) || {};
    if (rid && uid) void this.exit(Number(rid), Number(uid));
  }
}
