import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Serves the art extracted from the original APK.
 *
 * Catalogue rows (frames, entry effects, room backgrounds, medals) store a
 * RELATIVE path such as `ui/medal_1.webp`, never a full URL. The client joins
 * it to the `assetBase` handed out by app.getConfig, so the same database works
 * behind any host or CDN — baking `http://140.82.32.124:8077` into rows would
 * be the hardcoding this whole exercise is meant to remove.
 */
@Controller('assets')
export class AssetsController {
  /**
   * Repo-root assets directory, found by walking up from wherever this file
   * ended up. A fixed `../../../assets` is wrong in at least one of the two
   * layouts we run in — compiled under dist/src/gateway, or straight from
   * src/gateway — and it fails as a silent 404 rather than a startup error.
   */
  private static readonly ROOT = (() => {
    let dir = __dirname;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, 'assets');
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
      dir = path.dirname(dir);
    }
    return path.resolve(__dirname, '../../../assets'); // last resort
  })();

  private static readonly MIME: Record<string, string> = {
    '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
    '.svga': 'application/octet-stream', '.pag': 'application/octet-stream',
    '.json': 'application/json', '.zip': 'application/zip',
  };

  @Get('*')
  serve(@Param() params: any, @Res() res: any) {
    const rel = String(params['0'] ?? params['*'] ?? '');
    // Resolve, then confirm the result is still inside ROOT. Checking the input
    // for '..' is not enough — encodings and symlinks get past that; comparing
    // the resolved path is what actually holds.
    const abs = path.resolve(AssetsController.ROOT, rel);
    if (abs !== AssetsController.ROOT && !abs.startsWith(AssetsController.ROOT + path.sep))
      throw new NotFoundException();
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new NotFoundException();

    const mime = AssetsController.MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
    res.header('Content-Type', mime);
    res.header('Cache-Control', 'public, max-age=86400');
    return res.send(fs.createReadStream(abs));
  }
}
