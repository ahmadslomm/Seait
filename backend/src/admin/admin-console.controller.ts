import { Controller, Get, Res } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Serves the operator console single-page app at /admin.
 *
 * The page is a static file under backend/public so it can be edited without a
 * rebuild and is not bundled into dist; the path is found by walking up from
 * wherever this compiled file lands, the same trick AssetsController uses.
 */
@Controller('admin')
export class AdminConsoleController {
  private static readonly PAGE = (() => {
    let dir = __dirname;
    for (let i = 0; i < 6; i++) {
      const p = path.join(dir, 'public', 'console.html');
      if (fs.existsSync(p)) return p;
      dir = path.dirname(dir);
    }
    return path.resolve(__dirname, '../../public/console.html');
  })();

  @Get()
  index(@Res() res: any) {
    res.header('Content-Type', 'text/html; charset=utf-8');
    if (!fs.existsSync(AdminConsoleController.PAGE)) {
      return res.send('<h1>Console page missing</h1>');
    }
    return res.send(fs.createReadStream(AdminConsoleController.PAGE));
  }
}
