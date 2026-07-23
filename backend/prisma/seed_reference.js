#!/usr/bin/env node
/**
 * Reference and content data for the batch 2-5 endpoints.
 *
 * Same rule as the other seeds: only insert what makes an endpoint return
 * something true. Countries, games, topics, bomb configs and app version are
 * real reference data; a handful of moments, bottles and a lucky bag give the
 * feed and room-event endpoints non-empty responses to prove they work.
 *
 * Idempotent.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const ASSETS = path.resolve(__dirname, '../../assets');
const has = rel => rel && fs.existsSync(path.join(ASSETS, rel));

const OWNER = 1278472;
const people = Array.from({ length: 20 }, (_, i) => 900100 + i);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const int = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

const COUNTRIES = [
  ['SA', 'Saudi Arabia', '966'], ['EG', 'Egypt', '20'], ['AE', 'UAE', '971'],
  ['IQ', 'Iraq', '964'], ['MA', 'Morocco', '212'], ['JO', 'Jordan', '962'],
  ['KW', 'Kuwait', '965'], ['DZ', 'Algeria', '213'], ['QA', 'Qatar', '974'],
  ['BH', 'Bahrain', '973'], ['OM', 'Oman', '968'], ['LB', 'Lebanon', '961'],
  ['TN', 'Tunisia', '216'], ['LY', 'Libya', '218'], ['SD', 'Sudan', '249'],
  ['YE', 'Yemen', '967'], ['SY', 'Syria', '963'], ['PS', 'Palestine', '970'],
];

(async () => {
  // ── countries ──
  for (let i = 0; i < COUNTRIES.length; i++) {
    const [code, name, zone] = COUNTRIES[i];
    await prisma.countryZone.upsert({
      where: { code }, create: { code, name, zone, sort: i }, update: { name, zone, sort: i },
    });
  }

  // ── games (third-party web views; icons are the room game glyphs we have) ──
  const gameIcon = has('ui/gift_box.webp') ? 'ui/gift_box.webp' : '';
  const GAMES = [
    ['Ludo', 'amg'], ['Domino', 'amg'], ['Fruit Party', 'yomi'],
    ['Greedy', 'yomi'], ['Teen Patti', 'joyplay'],
  ];
  for (let i = 0; i < GAMES.length; i++) {
    const [name, provider] = GAMES[i];
    const existing = await prisma.game.findFirst({ where: { name } });
    const data = { name, provider, icon: gameIcon, url: `https://games.example/${provider}/${i}`, hot: int(0, 100), sort: i, active: true };
    if (existing) await prisma.game.update({ where: { game_id: existing.game_id }, data });
    else await prisma.game.create({ data });
  }

  // ── feed topics ──
  const TOPICS = ['اليوم', 'موسيقى', 'أصوات', 'تحدي', 'مسابقة'];
  for (let i = 0; i < TOPICS.length; i++) {
    const existing = await prisma.feedTopic.findFirst({ where: { name: TOPICS[i] } });
    const data = { name: TOPICS[i], hot: int(0, 999), sort: i, active: true };
    if (existing) await prisma.feedTopic.update({ where: { id: existing.id }, data });
    else await prisma.feedTopic.create({ data });
  }

  // ── bomb config + room level ladder + app version ──
  if (!await prisma.roomBombConfig.count())
    await prisma.roomBombConfig.createMany({
      data: [
        { name: 'Small Bomb', threshold: 1000, prize: 500 },
        { name: 'Big Bomb', threshold: 5000, prize: 3000 },
      ],
    });

  for (let lvl = 1; lvl <= 10; lvl++)
    await prisma.roomLevelConfig.upsert({
      where: { level: lvl },
      create: { level: lvl, needExp: BigInt(lvl * 10000), prize: lvl * 200 },
      update: {},
    });

  if (!await prisma.appVersion.count())
    await prisma.appVersion.create({
      data: { platform: 'android', version: '1.21.150', build: 150, notes: 'Seait build', force: false },
    });

  // ── some moments, a couple of bottles, one lucky bag ──
  if (await prisma.moment.count() < 6) {
    const topics = await prisma.feedTopic.findMany();
    for (let i = 0; i < 8; i++)
      await prisma.moment.create({
        data: {
          uid: rnd([OWNER, ...people]),
          text: rnd(['يوم جميل 🌟', 'من هنا 🎤', 'استمعوا لصوتي', 'نلتقي المساء', 'شكراً للجميع ❤️']),
          topicId: rnd(topics).id,
          likes: int(0, 50), views: int(0, 300),
        },
      });
  }

  if (await prisma.bottle.count() < 4) {
    for (let i = 0; i < 5; i++)
      await prisma.bottle.create({
        data: {
          uid: rnd(people), url: `https://cdn.example/song_${i}.mp3`,
          title: rnd(['أغنية', 'مقطع صوتي', 'تسجيل']), duration: int(15, 120),
          censor: 1, likes: int(0, 30), plays: int(0, 200),
        },
      });
  }

  if (!await prisma.luckyBag.count())
    await prisma.luckyBag.create({
      data: { rid: 1, from_uid: OWNER, coins: 1000, count: 10, expireAt: new Date(Date.now() + 86400000) },
    });

  // quick-chat + moment composer phrases
  await prisma.config.upsert({
    where: { key: 'quickChat' },
    create: { key: 'quickChat', value: ['مرحبا 👋', 'أهلاً وسهلاً', 'كيف حالك؟', 'صوتك جميل', 'مع السلامة'] },
    update: {},
  });
  await prisma.config.upsert({
    where: { key: 'momentSongTxt' },
    create: { key: 'momentSongTxt', value: ['استمعوا لصوتي', 'أغنيتي الجديدة', 'ما رأيكم؟'] },
    update: {},
  });

  console.log(
    `countries=${await prisma.countryZone.count()} games=${await prisma.game.count()} ` +
    `topics=${await prisma.feedTopic.count()} moments=${await prisma.moment.count()} ` +
    `bottles=${await prisma.bottle.count()} luckyBags=${await prisma.luckyBag.count()} ` +
    `levels=${await prisma.roomLevelConfig.count()} bombs=${await prisma.roomBombConfig.count()}`);
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
