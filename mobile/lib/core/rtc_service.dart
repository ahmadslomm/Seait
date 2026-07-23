import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

/// Credentials minted by the backend (`rtc.getToken`).
///
/// [role] is decided server-side from the caller's seat state, so a listener is
/// physically unable to publish — the client cannot promote itself.
class RtcCredentials {
  final String appId, channel;
  final int uid;
  final String? token;
  final String role;
  const RtcCredentials({
    required this.appId, required this.channel, required this.uid,
    required this.token, required this.role,
  });

  bool get isPublisher => role == 'publisher';
  bool get usable => appId.isNotEmpty;

  factory RtcCredentials.fromApi(Map d) => RtcCredentials(
    appId: '${d['appId'] ?? ''}',
    channel: '${d['channel'] ?? ''}',
    uid: int.tryParse('${d['uid'] ?? 0}') ?? 0,
    token: (d['token'] == null || '${d['token']}'.isEmpty) ? null : '${d['token']}',
    role: '${d['role'] ?? 'subscriber'}',
  );
}

/// Real-time voice for a room.
///
/// Deliberately separate from the Room Engine: the socket stays the source of
/// truth for seat/mic STATE, and this class only mirrors that state onto the
/// audio stream. Nothing here changes room logic.
///
/// Volume indication drives the speaking animation — we report level changes
/// through [onSpeaking] and the room screen relays them over the socket, so the
/// halo appears on every client rather than only locally.
class RtcService {
  RtcEngine? _engine;
  RtcCredentials? _creds;
  bool _joined = false;
  bool _muted = false;

  /// (uid, speaking) — uid 0 means the local user.
  void Function(int uid, bool speaking)? onSpeaking;
  void Function(int uid)? onUserJoined;
  void Function(int uid)? onUserOffline;
  void Function(String state)? onConnectionState;

  bool get joined => _joined;
  bool get muted => _muted;
  String get role => _creds?.role ?? 'subscriber';

  /// Speaking threshold on Agora's 0-255 scale. Below this counts as silence.
  static const int speakingThreshold = 30;
  final Map<int, bool> _speakingCache = {};

  Future<bool> _ensureMicPermission() async {
    final st = await Permission.microphone.request();
    return st.isGranted;
  }

  /// Join the room's audio channel. Safe to call when RTC is not configured —
  /// it simply reports false and the room keeps working without voice.
  Future<bool> join(RtcCredentials creds) async {
    if (!creds.usable) {
      debugPrint('[rtc] no appId configured — voice disabled');
      return false;
    }
    if (_joined) await leave();
    _creds = creds;

    // Publishers need the mic; listeners do not, so don't nag them for it.
    if (creds.isPublisher && !await _ensureMicPermission()) {
      debugPrint('[rtc] microphone permission denied');
      return false;
    }

    try {
      final e = createAgoraRtcEngine();
      await e.initialize(RtcEngineContext(
        appId: creds.appId,
        channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
      ));
      _engine = e;

      e.registerEventHandler(RtcEngineEventHandler(
        onJoinChannelSuccess: (conn, elapsed) {
          _joined = true;
          onConnectionState?.call('joined');
          debugPrint('[rtc] joined ${conn.channelId} as ${creds.role}');
        },
        onUserJoined: (conn, remoteUid, elapsed) => onUserJoined?.call(remoteUid),
        onUserOffline: (conn, remoteUid, reason) {
          _speakingCache.remove(remoteUid);
          onSpeaking?.call(remoteUid, false);
          onUserOffline?.call(remoteUid);
        },
        onConnectionStateChanged: (conn, state, reason) =>
            onConnectionState?.call(state.name),
        // Volume indication -> speaking animation.
        onAudioVolumeIndication: (conn, speakers, count, totalVolume) {
          for (final s in speakers) {
            final uid = s.uid ?? 0;
            final vol = s.volume ?? 0;
            final speaking = vol >= speakingThreshold;
            // Only emit on transitions so we don't spam the socket.
            if (_speakingCache[uid] != speaking) {
              _speakingCache[uid] = speaking;
              onSpeaking?.call(uid, speaking);
            }
          }
        },
      ));

      await e.enableAudio();
      await e.disableVideo();
      // 3 reports/sec is enough for a responsive halo without flooding.
      await e.enableAudioVolumeIndication(interval: 300, smooth: 3, reportVad: true);
      await e.setClientRole(
        role: creds.isPublisher
            ? ClientRoleType.clientRoleBroadcaster
            : ClientRoleType.clientRoleAudience,
      );

      await e.joinChannel(
        token: creds.token ?? '',
        channelId: creds.channel,
        uid: creds.uid,
        options: ChannelMediaOptions(
          clientRoleType: creds.isPublisher
              ? ClientRoleType.clientRoleBroadcaster
              : ClientRoleType.clientRoleAudience,
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          publishMicrophoneTrack: creds.isPublisher,
          autoSubscribeAudio: true,
        ),
      );
      return true;
    } catch (e) {
      debugPrint('[rtc] join failed: $e');
      await leave();
      return false;
    }
  }

  /// Mirror the seat's mic state onto the audio stream. The Room Engine remains
  /// authoritative — this only follows it.
  Future<void> setMuted(bool m) async {
    _muted = m;
    try { await _engine?.muteLocalAudioStream(m); } catch (e) { debugPrint('[rtc] mute: $e'); }
  }

  /// Promote/demote when the user takes or leaves a seat mid-session.
  Future<void> setPublisher(bool publisher) async {
    try {
      await _engine?.setClientRole(
        role: publisher ? ClientRoleType.clientRoleBroadcaster : ClientRoleType.clientRoleAudience);
      await _engine?.updateChannelMediaOptions(
        ChannelMediaOptions(publishMicrophoneTrack: publisher));
    } catch (e) {
      debugPrint('[rtc] setPublisher: $e');
    }
  }

  Future<void> leave() async {
    try { await _engine?.leaveChannel(); } catch (_) {}
    try { await _engine?.release(); } catch (_) {}
    _engine = null;
    _joined = false;
    _speakingCache.clear();
  }
}
