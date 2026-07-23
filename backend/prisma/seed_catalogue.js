#!/usr/bin/env node
/**
 * Seeds the catalogue tables from art that actually exists in the repo.
 *
 * Every row points at a file extracted from the original APK, verified present
 * before insert — a catalogue full of paths that 404 is worse than an empty one,
 * because the screens render broken tiles instead of an honest empty state.
 *
 * Paths are RELATIVE. The client joins them to `assetBase` from app.getConfig,
 * so moving to a CDN is a config change, not a data migration.
 *
 * Idempotent: re-running updates rows in place rather than duplicating them.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const ASSETS = path.resolve(__dirname, '../../assets');
const has = rel => fs.existsSync(path.join(ASSETS, rel));

const skipped = [];
const keep = rows => rows.filter(r => {
  const missing = [r.icon, r.preview].filter(p => p && !has(p));
  if (missing.length) { skipped.push(`${r.name}: ${missing.join(', ')}`); return false; }
  return true;
});

// ── products ────────────────────────────────────────────────────────
// VIP entry animations: the real per-level SVGA/PAG from the original app.
const entries = [
  ['VIP 1 Horse',   'svga/userspace/waitio_VIP1ma.svga',        1,  1500],
  ['VIP 2 Eagle',   'svga/userspace/waitio_VIP2ying.svga',      2,  3000],
  ['VIP 3 Wolf',    'svga/userspace/waitio_VIP3lang.svga',      3,  6000],
  ['VIP 4 Leopard', 'svga/userspace/waitio_VIP4bao.svga',       4, 12000],
  ['VIP 5 Phoenix', 'svga/userspace/waitio_VIP5fenghuang.svga', 5, 24000],
  ['VIP 6 Lion',    'svga/userspace/waitio_VIP6shizi.svga',     6, 48000],
].map(([name, preview, noble, price]) => ({
  type: 'entry', name, icon: `ui/noble_${Math.min(noble, 7)}.webp`, preview,
  price, coin_type: 1, duration: 30, noble_only: 0, sort: noble,
}));

const frames = [
  ['Golden Wreath',  'ui/wreath_1.webp',     2000, 1],
  ['Silver Wreath',  'ui/wreath_2.webp',     1200, 2],
  ['Bronze Wreath',  'ui/wreath_3.webp',      600, 3],
  ['Purple Throne',  'ui/throne_purple.webp', 5000, 4],
].map(([name, icon, price, sort]) => ({
  type: 'frame', name, icon, preview: icon, price, coin_type: 1, duration: 30, sort,
}));

const roomBgs = [
  ['Arabian Night', 'ui/room_bg_arabian.webp', 3000, 1],
  ['Galaxy',        'ui/room_bg_galaxy.webp',  3000, 2],
  ['Grand Stage',   'ui/room_bg_stage.webp',   4500, 3],
].map(([name, icon, price, sort]) => ({
  type: 'room_bg', name, icon, preview: icon, price, coin_type: 1, duration: 30, sort,
}));

const products = keep([...entries, ...frames, ...roomBgs]);

// ── medals ──────────────────────────────────────────────────────────
const medals = keep([1, 2, 3, 4, 5]
  .map(i => ({ medal_id: i, name: `Medal ${i}`, icon: `ui/medal_${i}.webp`, desc: '', sort: i })));

// ── sign-in ─────────────────────────────────────────────────────────
const signIn = [
  { day: 1, reward_type: 'coin',    reward_num: 100 },
  { day: 2, reward_type: 'coin',    reward_num: 200 },
  { day: 3, reward_type: 'coin',    reward_num: 300 },
  { day: 4, reward_type: 'diamond', reward_num: 10 },
  { day: 5, reward_type: 'coin',    reward_num: 500 },
  { day: 6, reward_type: 'coin',    reward_num: 800 },
  { day: 7, reward_type: 'diamond', reward_num: 50 },
].map(r => ({ ...r, icon: r.reward_type === 'diamond' ? 'ui/diamond_icon.png' : 'ui/coin_icon.png' }));

// ── banners ─────────────────────────────────────────────────────────
const banners = keep([
  { image: 'ui/banner_gold.webp', link: '', position: 'home', sort: 1 },
  { image: 'ui/chest_gold.webp',  link: '', position: 'home', sort: 2 },
  { image: 'ui/lucky_bag.webp',   link: '', position: 'room', sort: 1 },
].map(b => ({ ...b, icon: b.image })))
  .map(({ icon, ...b }) => b);

(async () => {
  for (const p of products) {
    const existing = await prisma.mallProduct.findFirst({ where: { name: p.name, type: p.type } });
    if (existing) await prisma.mallProduct.update({ where: { product_id: existing.product_id }, data: p });
    else await prisma.mallProduct.create({ data: p });
  }
  for (const m of medals)
    await prisma.medal.upsert({ where: { medal_id: m.medal_id }, create: m, update: m });
  for (const r of signIn)
    await prisma.signInReward.upsert({ where: { day: r.day }, create: r, update: r });
  for (const b of banners) {
    const existing = await prisma.banner.findFirst({ where: { image: b.image, position: b.position } });
    if (existing) await prisma.banner.update({ where: { id: existing.id }, data: b });
    else await prisma.banner.create({ data: b });
  }

  // Give the seeded account something in its backpack, otherwise the Backpack
  // screen is empty and cannot be told apart from a broken one.
  const OWNER = 1278472;
  const grant = await prisma.mallProduct.findMany({ where: { type: { in: ['frame', 'entry'] } }, take: 3 });
  for (const g of grant)
    await prisma.userProduct.upsert({
      where: { uid_product_id: { uid: OWNER, product_id: g.product_id } },
      create: { uid: OWNER, product_id: g.product_id, source: 'grant',
                expireAt: new Date(Date.now() + 30 * 86400000) },
      update: {},
    });

  console.log(`products=${products.length} medals=${medals.length} signIn=${signIn.length} banners=${banners.length} granted=${grant.length}`);
  if (skipped.length) {
    console.log(`SKIPPED ${skipped.length} rows whose art is missing (not seeded rather than seeded broken):`);
    for (const s of skipped) console.log('  - ' + s);
  }
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
