import { Injectable, Logger } from '@nestjs/common';
import { appendFileSync } from 'fs';
/** Records any action without a native handler (known-but-TODO or truly unknown) so missing
 *  APIs surface while the app runs. Writes JSONL to unknown-apis.log. */
@Injectable()
export class UnknownActionLogger {
  private log = new Logger('UnknownAPI');
  record(action: string, req: any, known: boolean) {
    const entry = { ts: new Date().toISOString(), action, known, uid: req.uid ?? req._login_uid, keys: Object.keys(req) };
    this.log.warn(`${known?'TODO':'UNKNOWN'} action=${action} keys=${entry.keys.join(',')}`);
    try { appendFileSync('unknown-apis.log', JSON.stringify(entry)+'\n'); } catch {}
  }
}
