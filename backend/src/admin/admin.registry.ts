import { AdminRole } from './admin-auth.service';

/** A field on a manageable entity, with the type the CRUD layer coerces to. */
export interface FieldDef {
  name: string;
  label?: string;
  type: 'string' | 'text' | 'int' | 'bigint' | 'bool' | 'enum' | 'asset' | 'json' | 'date' | 'readonly';
  required?: boolean;
  default?: any;
  options?: { label: string; value: any }[]; // for enum
  help?: string;
  /** asset kind hint for the picker: image | svga | pag | mp4 | any */
  asset?: string;
}

/** One manageable table (or a typed view over one). */
export interface EntityDef {
  key: string;            // url slug
  model: string;          // prisma delegate
  id: string;             // primary key field
  label: string;
  group: 'assets' | 'economy' | 'system';
  icon?: string;
  /** Values merged into every create and used as an equality filter on list. */
  fixed?: Record<string, any>;
  /** Extra non-equality list filter, e.g. { vip_only: { gt: 0 } }. */
  listWhere?: Record<string, any>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** Columns shown in the table (defaults to the first few fields). */
  columns?: string[];
  fields: FieldDef[];
  /** Minimum role to mutate. Reads need only `editor`. */
  writeRole?: AdminRole;
  /** Disable create/delete for fixed-row config tables (levels, rewards). */
  noCreate?: boolean;
  noDelete?: boolean;
}

const COIN_TYPE: FieldDef = {
  name: 'coin_type', label: 'Currency', type: 'enum',
  options: [{ label: 'Coins', value: 1 }, { label: 'Diamonds', value: 2 }], default: 1,
};
const ACTIVE: FieldDef = { name: 'active', label: 'Active', type: 'bool', default: true };
const SORT: FieldDef = { name: 'sort', label: 'Sort', type: 'int', default: 0, help: 'Lower shows first' };

/** A MallProduct-backed asset section for one product `type`. */
function productEntity(o: {
  key: string; label: string; type: string; icon?: string;
  vip?: 'vip' | 'free'; extraFields?: FieldDef[];
}): EntityDef {
  const gating: FieldDef[] = [
    { name: 'vip_only', label: 'Min VIP level', type: 'int', default: o.vip === 'vip' ? 1 : 0,
      help: '0 = anyone; otherwise the VIP level required to buy/equip' },
    { name: 'noble_only', label: 'Min noble level', type: 'int', default: 0 },
  ];
  return {
    key: o.key, model: 'mallProduct', id: 'product_id', label: o.label, group: 'assets', icon: o.icon,
    fixed: { type: o.type },
    listWhere: o.vip === 'vip' ? { vip_only: { gt: 0 } } : o.vip === 'free' ? { vip_only: 0 } : undefined,
    orderBy: { sort: 'asc' },
    columns: ['product_id', 'name', 'icon', 'price', 'coin_type', 'active'],
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'icon', label: 'Icon / still', type: 'asset', asset: 'image' },
      { name: 'preview', label: 'Animation', type: 'asset', asset: 'any', help: 'svga / pag / mp4 for animated items' },
      { name: 'price', type: 'int', default: 0 },
      COIN_TYPE,
      { name: 'duration', label: 'Duration (days)', type: 'int', default: 30, help: '0 = permanent' },
      { name: 'category', type: 'int', default: 0 },
      ...gating,
      ...(o.extraFields ?? []),
      SORT, ACTIVE,
    ],
  };
}

/**
 * The full set of manageable entities. The admin API and console are both
 * driven entirely by this list — adding a section is a registry entry, not new
 * endpoints or UI code.
 *
 * The nine asset categories the product spec names map here as: Backgrounds and
 * Room Decorations onto MallProduct `room_bg`/`decoration`; Room Themes onto
 * `theme`; VIP and User Frames onto `frame` split by vip_only; Entry Effects
 * onto `entry`; Gift Animations onto Gift; Medals and Noble Badges onto their
 * own tables. This mirrors how the app already resolves them, so managing them
 * here changes exactly what the client renders.
 */
export const ENTITIES: EntityDef[] = [
  // ── assets ──────────────────────────────────────────────────────────
  productEntity({ key: 'backgrounds', label: 'Backgrounds', type: 'room_bg', icon: '🖼️' }),
  productEntity({ key: 'themes', label: 'Room Themes', type: 'theme', icon: '🎨' }),
  productEntity({ key: 'vip-frames', label: 'VIP Frames', type: 'frame', vip: 'vip', icon: '👑' }),
  productEntity({ key: 'user-frames', label: 'User Frames', type: 'frame', vip: 'free', icon: '🖼' }),
  productEntity({ key: 'entry-effects', label: 'Entry Effects', type: 'entry', icon: '✨' }),
  productEntity({ key: 'decorations', label: 'Room Decorations', type: 'decoration', icon: '🎭' }),
  productEntity({ key: 'bubbles', label: 'Chat Bubbles', type: 'bubble', icon: '💬' }),
  productEntity({ key: 'rides', label: 'Rides', type: 'car', icon: '🏎️' }),

  {
    key: 'medals', model: 'medal', id: 'medal_id', label: 'Medals', group: 'assets', icon: '🏅',
    orderBy: { sort: 'asc' }, columns: ['medal_id', 'name', 'icon', 'active'],
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'icon', type: 'asset', asset: 'image' },
      { name: 'desc', label: 'Description', type: 'text' },
      SORT, ACTIVE,
    ],
  },
  {
    key: 'noble-badges', model: 'nobleLevel', id: 'level', label: 'Noble Badges', group: 'assets', icon: '⚜️',
    orderBy: { level: 'asc' }, columns: ['level', 'name', 'frame', 'horn'],
    fields: [
      { name: 'level', type: 'int', required: true, help: 'Noble tier this badge belongs to' },
      { name: 'name', type: 'string', required: true },
      { name: 'frame', label: 'Badge art', type: 'asset', asset: 'image' },
      { name: 'horn', label: 'Free horns/day', type: 'int', default: 0 },
      { name: 'privileges', type: 'json', help: 'Arbitrary privilege flags read by the client' },
    ],
  },
  {
    key: 'gifts', model: 'gift', id: 'gift_id', label: 'Gift Animations', group: 'assets', icon: '🎁',
    orderBy: { gift_id: 'asc' }, columns: ['gift_id', 'name', 'icon', 'price', 'anim_type', 'active'],
    fields: [
      { name: 'gift_id', type: 'int', required: true, help: 'Stable id the client sends when gifting' },
      { name: 'name', type: 'string', required: true },
      { name: 'icon', type: 'asset', asset: 'image' },
      { name: 'anim_url', label: 'Animation', type: 'asset', asset: 'any' },
      { name: 'anim_type', label: 'Animation type', type: 'enum',
        options: [{ label: 'None/Image', value: 0 }, { label: 'SVGA', value: 1 }, { label: 'PAG', value: 2 }, { label: 'MP4', value: 3 }], default: 0 },
      { name: 'price', type: 'int', default: 0 },
      COIN_TYPE,
      { name: 'category', type: 'int', default: 0, help: 'Gift panel tab' },
      { name: 'fullscreen', label: 'Fullscreen', type: 'bool', default: false, help: 'Big/legendary gifts' },
      ACTIVE,
    ],
  },

  // ── economy ─────────────────────────────────────────────────────────
  {
    key: 'recharge', model: 'mallProduct', id: 'product_id', label: 'Recharge Packages', group: 'economy', icon: '💰',
    fixed: { type: 'coins' }, orderBy: { sort: 'asc' },
    columns: ['product_id', 'name', 'price', 'icon', 'active'],
    fields: [
      { name: 'name', type: 'string', required: true, help: 'e.g. "+1000 Coins"' },
      { name: 'price', label: 'Coins granted', type: 'int', default: 0 },
      { name: 'icon', type: 'asset', asset: 'image' },
      { name: 'category', label: 'Bonus %', type: 'int', default: 0 },
      SORT, ACTIVE,
    ],
  },
  {
    key: 'vip-levels', model: 'vipLevel', id: 'level', label: 'VIP Levels', group: 'economy', icon: '💎',
    orderBy: { level: 'asc' }, columns: ['level', 'name', 'type', 'frame'], noDelete: true,
    fields: [
      { name: 'level', type: 'int', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'type', type: 'enum', options: [{ label: 'VIP', value: 'vip' }, { label: 'SVIP', value: 'svip' }], default: 'vip' },
      { name: 'frame', label: 'Frame art', type: 'asset', asset: 'image' },
      { name: 'privileges', type: 'json' },
    ],
  },
  {
    key: 'wealth-levels', model: 'wealthLevelConfig', id: 'level', label: 'Wealth Levels', group: 'economy', icon: '📈',
    orderBy: { level: 'asc' }, columns: ['level', 'name', 'needExp', 'icon'],
    fields: [
      { name: 'level', type: 'int', required: true },
      { name: 'name', type: 'string' },
      { name: 'needExp', label: 'Exp required', type: 'bigint', default: 0 },
      { name: 'icon', type: 'asset', asset: 'image' },
      { name: 'color', type: 'string', help: 'Hex, for the level badge' },
    ],
  },
  {
    key: 'rewards', model: 'signInReward', id: 'day', label: 'Daily Rewards', group: 'economy', icon: '📅',
    orderBy: { day: 'asc' }, columns: ['day', 'reward_type', 'reward_num', 'icon'], noDelete: true,
    fields: [
      { name: 'day', type: 'int', required: true, help: 'Day 1-7 of the cycle' },
      { name: 'reward_type', type: 'enum', options: [{ label: 'Coins', value: 'coin' }, { label: 'Diamonds', value: 'diamond' }, { label: 'Product', value: 'product' }], default: 'coin' },
      { name: 'reward_num', label: 'Amount', type: 'int', default: 0 },
      { name: 'product_id', label: 'Product (if product)', type: 'int' },
      { name: 'icon', type: 'asset', asset: 'image' },
    ],
  },
  {
    key: 'banners', model: 'banner', id: 'id', label: 'Banners', group: 'economy', icon: '🏳️',
    orderBy: { sort: 'asc' }, columns: ['id', 'image', 'position', 'active'],
    fields: [
      { name: 'image', type: 'asset', asset: 'image', required: true },
      { name: 'link', type: 'string', help: 'Deep link or url opened on tap' },
      { name: 'position', type: 'enum', options: [{ label: 'Home', value: 'home' }, { label: 'Room', value: 'room' }, { label: 'Me', value: 'me' }], default: 'home' },
      { name: 'startAt', type: 'date' }, { name: 'endAt', type: 'date' },
      SORT, ACTIVE,
    ],
  },
  {
    key: 'games', model: 'game', id: 'game_id', label: 'Mini Games', group: 'economy', icon: '🎮',
    orderBy: { sort: 'asc' }, columns: ['game_id', 'name', 'provider', 'active'],
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'icon', type: 'asset', asset: 'image' },
      { name: 'url', type: 'string' },
      { name: 'provider', type: 'string', help: 'amg | yomi | joyplay' },
      { name: 'hot', label: 'Popularity', type: 'int', default: 0 },
      SORT, ACTIVE,
    ],
  },

  // ── system ──────────────────────────────────────────────────────────
  {
    key: 'app-version', model: 'appVersion', id: 'id', label: 'App Versions', group: 'system', icon: '📱',
    orderBy: { build: 'desc' }, columns: ['id', 'platform', 'version', 'build', 'force'],
    fields: [
      { name: 'platform', type: 'enum', options: [{ label: 'Android', value: 'android' }, { label: 'iOS', value: 'ios' }], default: 'android' },
      { name: 'version', type: 'string', required: true },
      { name: 'build', type: 'int', default: 0 },
      { name: 'url', label: 'Download url', type: 'string' },
      { name: 'notes', type: 'text' },
      { name: 'force', label: 'Force update', type: 'bool', default: false },
    ],
  },
];

export const ENTITY_BY_KEY: Record<string, EntityDef> = Object.fromEntries(ENTITIES.map(e => [e.key, e]));
