import { ActionReq } from '../common/envelope';

/** An action handler: takes the decrypted request envelope, returns response_data. */
export type Handler = (r: ActionReq) => Promise<any>;

/**
 * One domain's slice of the api.php action surface.
 *
 * The original app funnels ~350 actions through a single endpoint, so without
 * some structure the router becomes one unreadable switch. Each domain module
 * owns its actions and its Prisma access; the router only dispatches. Adding an
 * endpoint means touching one domain file, not the gateway.
 */
export abstract class ApiModule {
  /** Actions this module answers, keyed by the exact original action name. */
  abstract readonly handlers: Record<string, Handler>;

  /** Caller uid — the client sends it in several places depending on the action. */
  protected uidOf(r: ActionReq): number {
    return Number(r._login_uid || r.uid || 0) || 0;
  }

  /** Page/limit as the original app sends them (1-based page). */
  protected page(r: ActionReq, size = 20) {
    const page = Math.max(1, Number(r.page || 1) || 1);
    const take = Math.min(100, Number(r.pageSize || r.limit || size) || size);
    return { skip: (page - 1) * take, take, page };
  }
}

/**
 * The client is a Java/Gson app: numeric ids and counters arrive as strings in
 * most payloads, and several screens compare them as strings. Prisma hands back
 * numbers and BigInt, and BigInt is not JSON-serialisable at all, so everything
 * crossing the boundary goes through here.
 */
export const s = (v: any): string => (v === null || v === undefined ? '' : String(v));
export const n = (v: any): number => Number(v ?? 0) || 0;
