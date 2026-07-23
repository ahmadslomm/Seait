#!/usr/bin/env node
/**
 * Populates the world so the social endpoints have something true to return.
 *
 * The database held exactly one user, which meant fans lists, recommendations,
 * search, supporters and room owners were all correctly implemented and all
 * correctly empty — indistinguishable, from the app, from being broken. Seed
 * data belongs here rather than in the client: the screens must read it through
 * the API, which is the whole point of removing the hardcoded values.
 *
 * Names are transliterated Arabic first names, matching the original app's
 * audience. Avatars use the one real bundled default rather than invented CDN
 * URLs that would 404 — an honest placeholder beats a broken link.
 *
 * Idempotent.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OWNER = 1278472;
const AVATAR = 'images/waitio_avatar_default_logo.png';

const PEOPLE = [
  ['نور', 'f'], ['أحمد', 'm'], ['سارة', 'f'], ['خالد', 'm'], ['ليلى', 'f'],
  ['عمر', 'm'], ['هدى', 'f'], ['يوسف', 'm'], ['ريم', 'f'], ['طارق', 'm'],
  ['مريم', 'f'], ['سامي', 'm'], ['دانا', 'f'], ['زياد', 'm'], ['جنى', 'f'],
  ['فهد', 'm'], ['لمى', 'f'], ['بدر', 'm'], ['شهد', 'f'], ['ماجد', 'm'],
];
const COUNTRIES = ['SA', 'EG', 'AE', 'IQ', 'MA', 'JO', 'KW', 'DZ'];
const SIGNS = ['أهلاً بالجميع', 'صوتي هنا', 'نلتقي كل مساء', 'أحب الغناء', ''];

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const int = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

(async () => {
  const uids = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const uid = 900100 + i;
    const [nick, sex] = PEOPLE[i];
    uids.push(uid);

    await prisma.user.upsert({
      where: { uid },
      create: {
        uid, nick, avatar: AVATAR, sex: sex === 'f' ? 2 : 1,
        sign: rnd(SIGNS), country: rnd(COUNTRIES), age: int(18, 38),
        isAnchor: i % 4 === 0, noble_level: i % 7, active_level: int(1, 40),
      },
      update: { nick, avatar: AVATAR },
    });
    await prisma.profile.upsert({
      where: { uid },
      create: { uid, levelName: `Lv${int(1, 40)}`, gifts: int(0, 500) },
      update: {},
    });
    await prisma.wallet.upsert({
      where: { uid },
      create: { uid, coins: BigInt(int(500, 50000)), diamonds: BigInt(int(0, 2000)) },
      update: {},
    });
    await prisma.wealth.upsert({
      where: { uid },
      create: { uid, wealthLv: int(1, 30), charmLv: int(1, 30), charm: BigInt(int(0, 90000)) },
      update: {},
    }).catch(() => null);
  }

  // A follow graph, so fans/following/friends differ from each other. Everyone
  // follows the main account; the main account follows back about half, which
  // is what makes the "friends = mutual" query return a meaningful subset.
  for (const uid of uids) {
    await prisma.friend.upsert({
      where: { uid_target_uid_type: { uid, target_uid: OWNER, type: 'follow' } },
      create: { uid, target_uid: OWNER, type: 'follow' }, update: {},
    });
  }
  for (const uid of uids.filter((_, i) => i % 2 === 0)) {
    await prisma.friend.upsert({
      where: { uid_target_uid_type: { uid: OWNER, target_uid: uid, type: 'follow' } },
      create: { uid: OWNER, target_uid: uid, type: 'follow' }, update: {},
    });
  }
  // Recent visitors to the main profile.
  for (const uid of uids.slice(0, 8)) {
    await prisma.friend.upsert({
      where: { uid_target_uid_type: { uid, target_uid: OWNER, type: 'visit' } },
      create: { uid, target_uid: OWNER, type: 'visit' }, update: {},
    });
  }

  // Spread room ownership around, so the Live tab is not six rooms by one host.
  const rooms = await prisma.room.findMany({ orderBy: { rid: 'asc' } });
  for (let i = 1; i < rooms.length; i++) {
    await prisma.room.update({
      where: { rid: rooms[i].rid },
      data: {
        owner_uid: uids[i % uids.length],
        country: COUNTRIES[i % COUNTRIES.length],
        onlineNum: int(3, 120),
      },
    });
  }
  // Room 1 stays with the main account — the RTC and room-engine tests rely on
  // it owning that room.
  await prisma.room.update({ where: { rid: rooms[0].rid }, data: { country: 'SA', onlineNum: int(5, 60) } });

  // Gift history, so charm/contribution ranks and supporters are real sums
  // rather than empty aggregates.
  const gifts = await prisma.gift.findMany({ take: 10 });
  if (gifts.length) {
    const existing = await prisma.giftRecord.count();
    if (existing < 40) {
      for (let i = 0; i < 60; i++) {
        const g = rnd(gifts);
        const num = int(1, 10);
        await prisma.giftRecord.create({
          data: {
            from_uid: rnd(uids), to_uid: i % 3 === 0 ? OWNER : rnd(uids),
            rid: rnd(rooms).rid, gift_id: g.gift_id, num,
            coin_total: BigInt(num * (g.price || 1)),
          },
        });
      }
    }
  }

  // A few unread notices so the Message tab's counters are non-zero.
  const already = await prisma.notice.count({ where: { uid: OWNER } });
  if (!already) {
    await prisma.notice.createMany({
      data: [
        { uid: OWNER, type: 'system', title: 'مرحباً بك', body: 'أهلاً بك في التطبيق' },
        { uid: OWNER, type: 'follow', title: 'متابع جديد', body: String(uids[0]) },
        { uid: OWNER, type: 'gift', title: 'هدية', body: String(uids[1]) },
        { uid: OWNER, type: 'activity', title: 'فعالية', body: '' },
      ],
    });
  }

  console.log(`users=${uids.length} rooms=${rooms.length} follows=${uids.length + Math.ceil(uids.length / 2)} giftRecords=${await prisma.giftRecord.count()} notices=${await prisma.notice.count({ where: { uid: OWNER } })}`);
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
