import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler } from './module.base';

/**
 * Server-driven art overrides — the Theme/Background Manager's data path.
 *
 * The client keeps a logical-key asset registry (`nav.home`, `room.bg.arabian`,
 * `medal.3`, …) with a bundled default per key. Anything returned here replaces
 * the bundled art at runtime, so re-skinning the app is a database edit rather
 * than a release. This is the endpoint the parked Me-header background will
 * eventually be delivered through.
 *
 * Overrides live in Config under `themeAssets` as a flat {logicalKey: path}
 * map. Paths are relative and joined to assetBase by the client, exactly like
 * the catalogue rows — so one CDN switch moves everything.
 */
@Injectable()
export class ThemeModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  readonly handlers: Record<string, Handler> = {
    'app.getThemeAssets': async (_r: ActionReq) => {
      const row = await this.prisma.config.findUnique({ where: { key: 'themeAssets' } }).catch(() => null);
      const overrides = (row?.value ?? {}) as Record<string, string>;
      const base = (await this.prisma.config.findUnique({ where: { key: 'assetBase' } }).catch(() => null))?.value ?? '/assets/';

      // Room backgrounds are sold from the catalogue, so they are also theme
      // slots. Deriving them here means adding a background to the store makes
      // it selectable in rooms — without a second place to register it, which
      // would inevitably drift out of step.
      const bgs = await this.prisma.mallProduct.findMany({
        where: { type: 'room_bg', active: true }, orderBy: { sort: 'asc' },
      });
      const derived: Record<string, string> = {};
      for (const b of bgs) {
        const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (b.icon) derived[`room.bg.${slug}`] = b.icon;
      }

      // Explicit overrides win over derived ones: an admin who pins a slot
      // means it.
      return { assetBase: base, ...derived, ...overrides };
    },
  };
}
