import { Injectable, Logger } from '@nestjs/common';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export type RtcCredentials = {
  appId: string;
  channel: string;
  uid: number;
  /** null when the project runs in App-ID-only (testing) security mode. */
  token: string | null;
  role: 'publisher' | 'subscriber';
  expiresIn: number;   // seconds
  expireAt: number;    // unix seconds
};

/**
 * Mints Agora RTC credentials for a room.
 *
 * Publishers (users on a mic seat) get a publisher token; listeners get a
 * subscriber token, so the *server* decides who is even able to send audio —
 * seat state is not merely a UI affordance.
 *
 * Configuration (env):
 *   AGORA_APP_ID           required to issue anything
 *   AGORA_APP_CERTIFICATE  optional; without it we run in App-ID-only mode
 *   AGORA_TOKEN_TTL        seconds, default 3600
 *
 * Note on the extracted app id: the original client shipped
 * agoraAppId=ae32cc1b085e4b27b08d3d664103b3c8, but the matching App Certificate
 * is a server-side secret that never ships in an APK. We therefore cannot mint
 * tokens for *that* project — supply your own Agora project's credentials.
 */
@Injectable()
export class RtcService {
  private readonly log = new Logger('RtcService');

  private get appId() { return process.env.AGORA_APP_ID || ''; }
  private get cert() { return process.env.AGORA_APP_CERTIFICATE || ''; }
  private get ttl() { return Number(process.env.AGORA_TOKEN_TTL || 3600); }

  /** True when we can issue signed tokens rather than App-ID-only joins. */
  get canSign() { return !!this.appId && !!this.cert; }

  channelFor(rid: number) { return `seait_room_${rid}`; }

  issue(rid: number, uid: number, publisher: boolean): RtcCredentials {
    const channel = this.channelFor(rid);
    const role = publisher ? 'publisher' : 'subscriber';
    const expireAt = Math.floor(Date.now() / 1000) + this.ttl;

    if (!this.appId) {
      this.log.warn('AGORA_APP_ID is not set — RTC disabled');
      return { appId: '', channel, uid, token: null, role, expiresIn: 0, expireAt: 0 };
    }

    if (!this.cert) {
      // Valid for projects whose security mode is "App ID only". The client
      // joins with a null token; Agora accepts it in that mode.
      return { appId: this.appId, channel, uid, token: null, role, expiresIn: this.ttl, expireAt };
    }

    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.cert,
      channel,
      uid,
      publisher ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      this.ttl,
      this.ttl,
    );
    return { appId: this.appId, channel, uid, token, role, expiresIn: this.ttl, expireAt };
  }
}
