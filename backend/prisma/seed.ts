import { PrismaClient } from '@prisma/client';
import * as p from './real_profile.json';
import * as cfg from './real_config.json';
const db = new PrismaClient();
const n = (x:any, d=0)=> x==null?d:Number(x);

async function main() {
  const uid = n(p.uid, 1278472);
  // --- User (real account 1278472) ---
  await db.user.upsert({ where:{ uid }, update:{}, create:{
    uid, mobile:(p as any).mobile, nick:p.nick, sex:n(p.sex), sign:p.sign, avatar:p.avatar,
    avatarFrame:p.avatarFrame, carFrame:(p as any).carFrame||'', chatBubble:p.chatBubble, infoBgImg:p.infoBgImg,
    birthday:p.birthday, country:String(p.country), regCountry:(p as any).reg_country, region:p.region, lang:p.lang,
    age:n(p.age), constellation:p.constellation, audit_avatar:n((p as any).audit_avatar), real_flag:n((p as any).real_flag),
    isAnchor:!!(p as any).isAnchor, isPresident:!!(p as any).isPresident, noble_level:n((p as any).noble_level),
    active_level:n((p as any).active_level), gameLv:n((p as any).gameLv), svip:n((p as any).svip), isBanned:n((p as any).isBanned),
  }});
  await db.profile.upsert({ where:{ uid }, update:{}, create:{
    uid, fans:n(p.fans), subs:n(p.subs), gifts:n(p.gifts), beans:n((p as any).beans), photos:n(p.photos), songs:n(p.songs),
    days:n(p.days), cost:BigInt(n(p.cost)), levelName:p.levelName, nationalFlag:(p as any).nationalFlag,
    actTitles:(p as any).actTitles||[], user_label:(p as any).user_label||[], medals:(p as any).medal||[],
    supporters:(p as any).supporters||[], supporters_num:n((p as any).supporters_num),
  }});
  await db.wealth.upsert({ where:{ uid }, update:{}, create:{
    uid, wealthLv:n((p as any).wealthLv), wealthExp:BigInt(n((p as any).wealthExp)), wealthLimit:BigInt(n((p as any).wealthLimit)),
    nextWealthLvExp:BigInt(n((p as any).nextWealthLvExp)), charmLv:n((p as any).charmLv), charm:BigInt(n(p.charm)), level:n((p as any).level),
  }});
  await db.wallet.upsert({ where:{ uid }, update:{}, create:{ uid, coins:5000n, diamonds:1200n, gold:0n, beans:BigInt(n((p as any).beans)) }});
  await db.userVip.upsert({ where:{ uid }, update:{}, create:{ uid, vip_level:0, noble_level:n((p as any).noble_level) }});
  await db.settings.upsert({ where:{ uid }, update:{}, create:{ uid, ...(( (p as any).hidden_settings)||{}) as any }}).catch(()=>{});
  // --- CP (real: partner 1150147, sweet 4887591) ---
  const cp=(p as any).cp_info||{};
  if (cp.hasCp) await db.cp.upsert({ where:{ uid_target_uid:{ uid, target_uid:n(cp.target_uinfo?.uid) } }, update:{}, create:{
    uid, target_uid:n(cp.target_uinfo?.uid), sweet_value:BigInt(n(cp.sweet_value)), cp_lv:n(cp.cp_lv), days:n(cp.days), hasCp:n(cp.hasCp) }});
  // --- Guild (real: 12147) ---
  const g=(p as any).guild_info||{};
  if (g.guild_id) { const guild = await db.guild.upsert({ where:{ guild_id:n(g.guild_id) }, update:{}, create:{
      guild_id:n(g.guild_id), name:g.name, owner_uid:n(g.id), avatar:g.avatar, anchorNum:n(g.anchorNum) }});
    await db.guildMember.upsert({ where:{ guild_id_uid:{ guild_id:guild.guild_id, uid } }, update:{}, create:{ guild_id:guild.guild_id, uid }}).catch(()=>{}); }
  // --- Config (server map + SDK keys from real preArea.getServer) ---
  await db.config.upsert({ where:{ key:'server' }, update:{ value: cfg as any }, create:{ key:'server', value: cfg as any }});
  // --- VIP / Noble levels 1-5 ---
  for (const lv of [1,2,3,4,5]) await db.vipLevel.upsert({ where:{ level:lv }, update:{}, create:{ level:lv, name:`VIP ${lv}`, type:'vip', privileges:[`badge`,`frame`,`entry`,`chatBubble`].slice(0,lv) }});
  for (const lv of [1,2,3,4,5]) await db.nobleLevel.upsert({ where:{ level:lv }, update:{}, create:{ level:lv, name:['Knight','Baron','Viscount','Earl','King'][lv-1], horn:lv, privileges:[`entry`,`horn`,`badge`,`fly`,`throne`].slice(0,lv) }});
  // --- Gifts wired to real extracted SVGA/PAG (assets/svga, assets/pag).
  //     anim_type: 0 image  1 svga  2 pag.  Empty anim_url => client logs it to
  //     unknown-gifts.log (Rose has no extracted art — exercises that path).
  //     [gift_id, name, price, coin_type, anim_type, anim_url, category]
  const gifts:any[] = [
    [1, 'Rose',           10,    1, 0, '',                                              0],
    [2, 'Lucky Bag',      99,    1, 1, 'assets/svga/kroom/waitio_lucky_gift.svga',      1],
    [3, 'Firework',       199,   1, 1, 'assets/svga/kroom/waitio_lucky_gift_winning.svga', 1],
    [4, 'Golden Medal',   300,   1, 1, 'assets/svga/medal/waitio_xunzhangguang.svga',   4],
    [5, 'CP Heart',       520,   2, 2, 'assets/pag/cp/waitio_cp_heart.pag',             3],
    [6, 'Bomb',           888,   1, 2, 'assets/pag/bomb/waitio_bomb_anim_lv3.pag',      0],
    [7, 'Rocket',         5000,  2, 1, 'assets/svga/rocket/waitio_room_rocket.svga',    2],
    [8, 'Sports Car',     9999,  2, 1, 'assets/svga/rocket/waitio_rocket1.svga',        2],
    [9, 'Crown of Glory', 14999, 2, 1, 'assets/svga/rocket/waitio_rocket_top1.svga',    2],
    [10,'Angel Scepter',  19999, 2, 1, 'assets/svga/rocket/waitio_rocket_top2.svga',    2],
  ];
  for (const [gid,name,price,ct,anim,url,cat] of gifts) await db.gift.upsert({
    where:{ gift_id:gid }, update:{ anim_type:anim, anim_url:url, category:cat, fullscreen:price>=5000 },
    create:{ gift_id:gid, name, price, coin_type:ct, anim_type:anim, anim_url:url, category:cat, fullscreen:price>=5000, active:true }});
  // --- Sample rooms ---
  for (let i=1;i<=6;i++) await db.room.upsert({ where:{ rid:i }, update:{}, create:{ rid:i, owner_uid:uid, name:`Room ${i}`, roomType:i%3, seatCount:[5,10,15,21,30][i%5], onlineNum:10+i*3, roomLevel:i }});
  // --- Ranking sample ---
  for (let r=1;r<=10;r++) await db.ranking.create({ data:{ rank_type:'gift', period:'total', uid: uid- r, score:BigInt(100000-r*5000), rank:r }}).catch(()=>{});
  console.log('Seeded real account', uid, p.nick, 'wealthLv', (p as any).wealthLv, 'noble', (p as any).noble_level);
}
main().finally(()=>db.$disconnect());
