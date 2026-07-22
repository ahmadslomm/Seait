import { createHash } from 'crypto';
const PKG = process.env.PACKAGE_NAME || 'com.waig.nalo';
const API_KEY = Buffer.from(createHash('md5').update(PKG).digest('hex')); // md5(pkg) as 32 ascii hex bytes
function xor(d: Buffer, k: Buffer): Buffer { const o = Buffer.allocUnsafe(d.length); for (let i=0;i<d.length;i++) o[i]=d[i]^k[i%k.length]; return o; }
export function encryptBody(json: string): string { return xor(Buffer.from(json,'utf8'), API_KEY).toString('base64'); }
export function decryptBody(b: string): string { let s=decodeURIComponent(b).replace(/_/g,'/'); while(s.length%4) s+='='; return xor(Buffer.from(s,'base64'), API_KEY).toString('utf8'); }
export const PACKAGE_NAME = PKG;
