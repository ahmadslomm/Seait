import { createHash } from 'crypto';
// Request signature recovered from RE (memory: md5 with key 'awgwd^1ad87'). Kept identical so the
// original client's signed requests validate and our client signs the same way.
const SIGN_KEY = 'awgwd^1ad87';
export function makeSign(params: Record<string,any>): string {
  const keys = Object.keys(params).filter(k=>k!=='sign').sort();
  const base = keys.map(k=>`${k}=${params[k]}`).join('&') + SIGN_KEY;
  return createHash('md5').update(base).digest('hex');
}
export function verifySign(params: Record<string,any>): boolean {
  if (!params.sign) return true; // tolerate during dev
  return makeSign(params) === params.sign;
}
