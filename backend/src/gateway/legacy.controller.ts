import { Controller, All, Get, Post, Param, Query, Body, Res, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The non-`api.php` surface: plain HTTP endpoints and H5 pages.
 *
 * The inventory lists these alongside the JSON-RPC actions because they were
 * recovered from the same decrypted string table, but they are a different kind
 * of thing — the client hits them directly (payments, SMS, log upload) or opens
 * them in a web view (activity pages). They cannot be handlers on the action
 * router, so they live here.
 *
 * Where a real integration is missing (Google Play, SMS provider, Tencent IM)
 * these return an explicit `not_configured` rather than a plausible success.
 * A fake receipt validation is worse than no endpoint: it would silently grant
 * currency for unverified purchases.
 */
@Controller()
export class LegacyController {
  constructor(private prisma: PrismaService) {}

  private notConfigured(what: string) {
    return { code: 1, error: `${what}_not_configured`, response_data: false };
  }

  // ── telemetry ─────────────────────────────────────────────────────
  // Fire-and-forget from the client; accepting and discarding is the correct
  // behaviour, but say so rather than pretending it was stored.
  //
  // NestJS does NOT stack multiple route decorators on one method — only the
  // last wins — so the underscore and slash spellings the string table records
  // (`api_v1_upload_applog` vs `api/v1/upload/applog`) each need their own
  // method. They delegate to one implementation.
  @All('api/v1/upload/applog')
  applog() { return { code: 0, stored: 0, note: 'accepted, not retained' }; }
  @All('api_v1_upload_applog')
  applog2() { return this.applog(); }

  @All('api_v1_report_single')
  reportSingle() { return { code: 0 }; }

  // ── reference data ────────────────────────────────────────────────
  @Get('api_GetCountry.php')
  async countries() {
    const rows = await this.prisma.countryZone.findMany({ orderBy: { sort: 'asc' } });
    return { code: 0, response_data: rows.map(c => ({ code: c.code, name: c.name, zone: c.zone, flag: c.flag })) };
  }

  // ── IM signature ──────────────────────────────────────────────────
  // The original used Tencent IM. Our messaging runs on the room socket, so
  // there is no third-party signature to mint.
  @All('api/GetUserSig.php')
  userSig() { return this.notConfigured('im_provider'); }
  @All('api_GetUserSig.php')
  userSig2() { return this.notConfigured('im_provider'); }

  // ── third-party account binding ───────────────────────────────────
  @All('api_bind_google.php')
  bindGoogle() { return this.notConfigured('google_oauth'); }

  @All('api_bind_facebook.php')
  bindFacebook() { return this.notConfigured('facebook_oauth'); }

  // ── SMS kit ───────────────────────────────────────────────────────
  @All('api_sms_kit_register_user_by_sms_kit.php')
  smsRegister() { return this.notConfigured('sms_provider'); }

  @All('api_sms_kit_bind_mobile_by_sms_kit.php')
  smsBind() { return this.notConfigured('sms_provider'); }

  @All('api_sms_kit_update_passwd_by_sms_kit.php')
  smsPasswd() { return this.notConfigured('sms_provider'); }

  // ── Google Play billing ───────────────────────────────────────────
  // productList is answerable from our own catalogue; anything that VALIDATES
  // a purchase needs Google's servers and must not be faked. Both the flat
  // (`googleplay_*`) and pathed (`googleplaySub/*`) spellings appear in the
  // string table, so each gets its own method delegating to one body.
  private async productList() {
    const rows = await this.prisma.mallProduct.findMany({ where: { active: true, type: 'coins' } });
    return {
      code: 0,
      response_data: rows.map(p => ({
        product_id: String(p.product_id), sku: `coins_${p.price}`,
        name: p.name, price: String(p.price), icon: p.icon,
      })),
    };
  }
  @All('googleplay_productList.php')
  products() { return this.productList(); }
  @All('googleplaySub_subProductList.php')
  products2() { return this.productList(); }
  @All('googleplaySub/subProductList.php')
  products3() { return this.productList(); }

  @All('googleplay_getOrder.php')
  order() { return this.notConfigured('billing'); }
  @All('googleplaySub_getSubOrder.php')
  order2() { return this.notConfigured('billing'); }
  @All('googleplaySub/getSubOrder.php')
  order3() { return this.notConfigured('billing'); }

  @All('googleplay_getReceipt.php')
  receipt() { return this.notConfigured('billing'); }
  @All('googleplaySub_getSubReceipt.php')
  receipt2() { return this.notConfigured('billing'); }
  @All('googleplaySub/getSubReceipt.php')
  receipt3() { return this.notConfigured('billing'); }

  // ── H5 pages ──────────────────────────────────────────────────────
  /**
   * Activity pages the client opens in a web view.
   *
   * The original ships hand-authored HTML per activity; none of it was
   * recovered. Rather than 404 (which shows the web view's own error page) or
   * invent activity content, each route renders a page that states plainly
   * that the activity is not configured, in the app's colours so it does not
   * look like a crash. The route existing is what matters: the client's link
   * resolves and the web view closes cleanly.
   */
  @Get('html/*')
  h5(@Param() params: any, @Res() res: any) {
    const path = String(params['0'] ?? '').split('?')[0];
    return this.page(res, path.replace(/\/index\.(html|php)$/, '').replace(/[-_/]+/g, ' ').trim() || 'Activity');
  }

  @Get('share_room/index.php')
  shareRoom(@Query('rid') rid: string, @Res() res: any) {
    return this.page(res, `Room ${rid ?? ''}`.trim(), 'Open the app to join this room.');
  }

  @Get('share_bottle/index.php')
  shareBottle(@Res() res: any) {
    return this.page(res, 'Shared clip', 'Open the app to listen.');
  }

  @Get('index.php')
  index(@Res() res: any) {
    return this.page(res, 'Seait', 'API server. The app talks to /api.php.');
  }

  private page(res: any, title: string, body = 'This activity is not configured on this server.') {
    const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    res.header('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
html,body{margin:0;height:100%;background:#1B0E2B;color:#EDE7F6;
font:16px/1.5 -apple-system,Roboto,"Segoe UI",sans-serif;
display:flex;align-items:center;justify-content:center;text-align:center}
main{padding:24px;max-width:32rem}h1{font-size:1.25rem;margin:0 0 .5rem;color:#E7C46B}
p{margin:0;opacity:.75;font-size:.95rem}
</style></head><body><main><h1>${esc(title)}</h1><p>${esc(body)}</p></main></body></html>`);
  }
}
