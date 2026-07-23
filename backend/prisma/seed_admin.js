#!/usr/bin/env node
/**
 * Bootstraps the operator console: a first super-admin, the wealth-level ladder
 * (which had no config table before), and VIP/Noble level rows so those admin
 * sections open non-empty.
 *
 * The default admin password is read from ADMIN_SEED_PASSWORD or falls back to a
 * random one printed once — never a hard-coded default that ships live. Re-runs
 * do not reset an existing admin's password.
 *
 * Idempotent.
 */
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');
const prisma = new PrismaClient();

function hash(pw, salt) { return scryptSync(pw, salt, 64).toString('hex'); }

(async () => {
  // ── first super-admin ──
  const username = process.env.ADMIN_SEED_USER || 'admin';
  let generated = null;
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (!existing) {
    const password = process.env.ADMIN_SEED_PASSWORD || (generated = randomBytes(9).toString('base64url'));
    const salt = randomBytes(16).toString('hex');
    await prisma.adminUser.create({
      data: { username, salt, passwordHash: hash(password, salt), role: 'super' },
    });
  }

  // ── wealth ladder (10 tiers) ──
  for (let level = 1; level <= 10; level++) {
    await prisma.wealthLevelConfig.upsert({
      where: { level },
      create: { level, name: `Tier ${level}`, needExp: BigInt(level * level * 5000) },
      update: {},
    });
  }

  // ── VIP levels (fill 1..5 if empty) ──
  if (!await prisma.vipLevel.count()) {
    for (let level = 1; level <= 5; level++)
      await prisma.vipLevel.create({ data: { level, name: `VIP ${level}`, type: 'vip' } });
  }
  // ── Noble levels (fill 1..7 if empty) ──
  if (!await prisma.nobleLevel.count()) {
    const names = ['Knight', 'Baron', 'Viscount', 'Earl', 'Marquis', 'Duke', 'King'];
    for (let level = 1; level <= 7; level++)
      await prisma.nobleLevel.create({ data: { level, name: names[level - 1], horn: level } });
  }

  const total = await prisma.adminUser.count();
  console.log(`admins=${total} wealthLevels=${await prisma.wealthLevelConfig.count()} vip=${await prisma.vipLevel.count()} noble=${await prisma.nobleLevel.count()}`);
  if (generated) console.log(`\n  >>> Seeded super-admin "${username}" with password: ${generated}\n  >>> (set ADMIN_SEED_PASSWORD to choose your own; this is shown once.)\n`);
  else if (!existing) console.log(`  super-admin "${username}" created with ADMIN_SEED_PASSWORD.`);
  else console.log(`  admin "${username}" already exists — password unchanged.`);
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
