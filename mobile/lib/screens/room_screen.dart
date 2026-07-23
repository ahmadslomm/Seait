import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../core/asset_registry.dart';
import '../core/room_socket.dart';
import '../core/rtc_service.dart';
import '../core/config.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../ui/components.dart';
import '../providers.dart';
import '../core/api.dart';
import '../gift_engine/gift_engine.dart';
import '../gift_engine/gift_models.dart';
import '../gift_engine/animation_manager.dart';

/// Voice Room — reproduces the app's live room: dynamic seat grid (5/10/15/21/30),
/// gift banner, chat (All/Message/Gift), bottom bar, gift panel. Real-time via RoomSocket.
class RoomScreen extends ConsumerStatefulWidget {
  final int rid;
  /// QA-only: force the decorative win plate on (see kDemoTriggers).
  final bool demoBanner;
  const RoomScreen({super.key, required this.rid, this.demoBanner = false});
  @override ConsumerState<RoomScreen> createState() => _RoomState();
}

class _RoomState extends ConsumerState<RoomScreen> {
  final socket = RoomSocket();
  final rtc = RtcService();
  bool _rtcReady = false;
  int seatCount = 0;              // authoritative value arrives from room data
  List seats = [];
  final chat = <Map>[];
  String? giftBanner;
  bool _joined = false;
  String myRole = 'user';          // assigned by the server on join
  List<Map> users = [];            // live occupant list
  final _chatCtl = TextEditingController();
  bool get isStaff => myRole == 'owner' || myRole == 'admin';

  GiftEngine get _engine => ref.read(giftEngineProvider);

  /// Rebuild the local seat list whenever the room's seat count changes.
  void _sizeSeats(int n) {
    if (n <= 0 || n == seatCount) return;
    setState(() {
      seatCount = n;
      seats = List.generate(n, (i) => {'seatNo': i, 'uid': null, 'micState': 0, 'charmValue': 0});
    });
    if (!_joined) {
      socket.join(widget.rid, Cfg.myUid, seatCount: n);
      _joined = true;
      _joinRtc();
    }
  }

  @override void initState() {
    super.initState();
    // Load the REAL gift catalog (gift.getGiftList) into the engine.
    ref.read(giftsProvider.future).then((g) { _engine.clear(); _engine.loadCatalog(g); }).catchError((_) {});
    socket.connect();
    socket.on('room_state', (d) {
      if (d is! Map) return;
      setState(() {
        if (d['seats'] != null) seats = d['seats'];
        if (d['members'] != null) users = List<Map>.from((d['members'] as List).whereType<Map>());
      });
    });
    socket.on('role', (d) { if (d is Map && d['uid'] == Cfg.myUid) setState(() => myRole = '${d['role']}'); });
    socket.on('users_update', (d) { if (d is Map && d['users'] is List) {
      setState(() => users = List<Map>.from((d['users'] as List).whereType<Map>())); } });
    socket.on('seat_update', (s) {
      if (s is! Map) return;
      setState(() { if (s['seatNo'] < seats.length) seats[s['seatNo']] = s; });
      // Taking or leaving a seat promotes/demotes the audio role live.
      if (s['uid'] == Cfg.myUid) rtc.setPublisher(true);
      else if (_seatOfUid(Cfg.myUid) < 0) rtc.setPublisher(false);
    });
    socket.on('mic_status', (s) {
      if (s is! Map) return;
      setState(() { if (s['seatNo'] < seats.length) seats[s['seatNo']] = s; });
      // Mirror MY seat's mic state onto the real audio stream. The Room Engine
      // stays authoritative; RTC only follows it.
      if (s['uid'] == Cfg.myUid) rtc.setMuted(s['micState'] == 1);
    });
    socket.on('speaking', (d) { if (d is Map) { final n = d['seatNo']; if (n is int && n < seats.length) {
      setState(() => seats[n] = {...(seats[n] as Map), 'speaking': d['speaking'] == true}); } } });
    socket.on('chat', (d) { if (d is Map) setState(() {
      chat.add(Map<String, dynamic>.from(d)); if (chat.length > 200) chat.removeAt(0); }); });
    // A denied request comes back from the server — surface it rather than fail silently.
    socket.on('action_denied', (d) { if (d is Map && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${d['action']}: ${d['reason']}'), duration: const Duration(seconds: 2))); } });
    socket.on('user_leave', (d) { if (d is Map) setState(() => users.removeWhere((u) => u['uid'] == d['uid'])); });
    socket.on('user_kicked', (d) { if (d is Map && d['uid'] == Cfg.myUid && mounted) Navigator.of(context).maybePop(); });
    // Gift events (room broadcast) → animation engine (req 4).
    void onGift(d) {
      if (d is Map) {
        _engine.receive(_engine.eventFromPayload(d, roomId: widget.rid));
        setState(() => giftBanner = '${d['fromName'] ?? "U${d['fromUid'] ?? ''}"} sent a gift x${d['num'] ?? 1}');
      }
    }
    socket.on('gift_received', onGift);
    socket.on('gift_broadcast', onGift);
    // Entry effect (gift-engine Layer 5). The server now sends the full profile,
    // so the banner shows the real nick/avatar and only nobles trigger an effect.
    socket.on('user_enter', (d) {
      if (d is! Map) return;
      final uid = int.tryParse('${d['uid']}') ?? 0;
      final nick = '${d['nick'] ?? 'U$uid'}';
      setState(() {
        users.removeWhere((u) => u['uid'] == uid);
        users.add(Map<String, dynamic>.from(d));
        chat.add({'system': true, 'nick': nick, 'text': 'entered the room'});
      });
      final noble = int.tryParse('${d['noble_level'] ?? 0}') ?? 0;
      if (noble > 0) {
        _engine.showEntrance(EntranceEvent(uid: uid, name: nick,
          avatar: '${d['avatar'] ?? ''}', nobleLevel: noble));
      }
    });
  }
  /// Fetch server-minted credentials and join the audio channel. The backend
  /// decides publisher vs subscriber from seat state, so this cannot self-promote.
  Future<void> _joinRtc() async {
    try {
      final d = await ref.read(apiProvider)
          .call('rtc.getToken', params: {'rid': widget.rid, 'uid': Cfg.myUid});
      if (d is! Map) return;
      final creds = RtcCredentials.fromApi(d);
      rtc.onSpeaking = (uid, speaking) {
        // uid 0 is me; relay over the socket so every client shows the halo.
        final myUid = uid == 0 ? Cfg.myUid : uid;
        final seat = _seatOfUid(myUid);
        if (seat >= 0) socket.setSpeaking(widget.rid, seat, speaking);
      };
      final okJoin = await rtc.join(creds);
      if (mounted) setState(() => _rtcReady = okJoin);
    } catch (e) {
      debugPrint('[room] rtc setup failed: $e');
    }
  }

  int _seatOfUid(int uid) {
    for (final s in seats) { if (s is Map && s['uid'] == uid) return s['seatNo'] as int; }
    return -1;
  }

  @override void dispose() {
    rtc.leave();
    socket.leave(widget.rid, Cfg.myUid);
    _chatCtl.dispose();
    socket.dispose();
    super.dispose();
  }

  /// Send locally (optimistic) + over the socket. The engine plays it instantly
  /// (like nalo/HelloYo), and the server broadcast reflects it to others.
  void _sendGift(GiftDef def, int qty) {
    socket.sendGift(widget.rid, Cfg.myUid, 0, def.giftId, qty, def.price);
    _engine.receive(GiftEvent(def: def, senderUid: Cfg.myUid, senderName: 'Me', roomId: widget.rid, count: qty));
    // Mirror the original's win/gift plate above the seats.
    setState(() => giftBanner = 'Me sends ${def.name} x$qty  ·  returns ${def.price * qty} coins');
  }

  /// Column count comes from the room's own seat count — the original lays 5/10/15
  /// seat rooms out 5-across and larger rooms 6-across. No fixed assumption.
  int _cols(int n) {
    if (n <= 0) return 5;
    if (n % 5 == 0 && n <= 15) return 5;
    if (n % 6 == 0) return 6;
    return n <= 12 ? 4 : 5;
  }

  @override Widget build(BuildContext c) {
    final info = ref.watch(roomInfoProvider(widget.rid));
    final room = info.asData?.value ?? const {};
    // seat count is authoritative room data (falls back to the socket's view)
    final n = int.tryParse('${room['seatCount'] ?? ''}') ?? seats.length;
    WidgetsBinding.instance.addPostFrameCallback((_) => _sizeSeats(n));

    final cols = _cols(seatCount);
    final cover = '${room['cover'] ?? ''}';
    final theme = ['arabian', 'galaxy', 'stage'][(int.tryParse('${room['roomType'] ?? 0}') ?? 0) % 3];
    final width = MediaQuery.of(c).size.width;
    final seatD = width * 0.107;   // measured from the original: Ø ≈ 10.7% of width
    // Owner shown in cell 0 (original always renders the room owner there).
    final ownerUid = int.tryParse('${room['owner_uid'] ?? ''}') ?? 0;
    final ownerRec = ownerUid == 0 ? const {}
      : (ref.watch(userInfoProvider(ownerUid)).asData?.value ?? const {});
    // Derived in build (not initState): re-delivering the deep link to an
    // already-open room reuses the State, so initState would never re-run.
    final banner = giftBanner ?? ((kDemoTriggers && widget.demoBanner)
      ? 'اونــلاين sends Lucky Bag  ·  100 times returns 4500 coins' : null);

    return Scaffold(
      body: Stack(children: [
      // Backdrop: the room's own cover art when the API supplies one, otherwise
      // the bundled theme selected by the room's type (never a fixed index).
      Positioned.fill(child: cover.startsWith('http')
        ? CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover,
            errorWidget: (_, __, ___) => _backdrop(theme))
        : _backdrop(theme)),
      Positioned.fill(child: Container(color: const Color(0x442A1148))), // legibility scrim
      // Positioned.fill: the seat grid is shrink-wrapped, so without this the
      // Column sizes to its children and leaves dead space under the bottom bar.
      Positioned.fill(child: SafeArea(child: Column(children: [
          _topBar(c, room),
          if (banner != null) _banner(banner),
          // Seat grid — host occupies cell 0 exactly like the original; every
          // other cell is "No.N". Sizes derive from the measured proportions.
          Padding(padding: const EdgeInsets.fromLTRB(6, 6, 6, 0),
            child: GridView.count(
              crossAxisCount: cols, shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: .78, mainAxisSpacing: 2, crossAxisSpacing: 2,
              children: [for (int i = 0; i < seats.length; i++) _seat(seats[i], i, seatD, ownerRec)])),
          Expanded(child: _chatFeed()),
          _bottomBar(c),
        ]))),
      const Positioned.fill(child: GiftStage()), // 5-layer gift overlay
      ]),
    );
  }

  /// Bundled backdrop for a theme name, resolved through the asset registry so
  /// a server-side theme manager can override it without touching this screen.
  Widget _backdrop(String theme) {
    final a = Assets.roomBackdrop(theme);
    // A server override is a url; the bundled default is an asset key.
    if (Assets.isRemote(a)) {
      return CachedNetworkImage(imageUrl: a!, fit: BoxFit.cover,
        errorWidget: (_, __, ___) => _gradient());
    }
    return Image.asset(a ?? '', fit: BoxFit.cover, errorBuilder: (_, __, ___) => _gradient());
  }

  Widget _gradient() => const DecoratedBox(decoration: BoxDecoration(
      gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0xFF3A1D6E), Color(0xFF1A0B2E)])));

  /// One grid cell. Index 0 is the host/owner chair: the original always shows
  /// the room OWNER there (avatar + decoration frame + name), even before anyone
  /// takes a mic, so fall back to the owner record for that cell.
  Widget _seat(dynamic s, int i, double d, [Map owner = const {}]) {
    final m = (s is Map) ? s : const {};
    final host = i == 0;
    // The seat's occupant profile arrives nested under 'profile' (room_state and
    // seat_update both decorate it); fall back to the flat map for older shapes.
    final prof = (m['profile'] is Map) ? m['profile'] as Map : m;
    final src = (host && m['uid'] == null && owner.isNotEmpty) ? owner : prof;
    final uid = src['uid'] ?? m['uid'];
    return RoomSeat(
      no: i + 1,
      diameter: d,
      host: host,
      avatarUrl: '${src['avatar'] ?? ''}'.isEmpty ? null : '${src['avatar']}',
      frameUrl: '${src['avatarFrame'] ?? ''}'.isEmpty ? null : '${src['avatarFrame']}',
      name: '${src['nick'] ?? ''}',
      charm: int.tryParse('${m['charmValue'] ?? 0}') ?? 0,
      micOff: (int.tryParse('${m['micState'] ?? 0}') ?? 0) == 1,
      locked: (int.tryParse('${m['lock'] ?? 0}') ?? 0) == 1,
      speaking: m['speaking'] == true,
      onTap: uid == null
        ? () => socket.takeSeat(widget.rid, i, Cfg.myUid)
        : (uid == Cfg.myUid
            ? () => socket.leaveSeat(widget.rid, Cfg.myUid)      // stand up
            : (isStaff ? _showUsers : null)),                     // moderate
    );
  }

  // Compact icon buttons + a flexible room chip so the bar never overflows on
  // narrow phones (360dp) — same layout, just constrained.
  static const _tightBtn = BoxConstraints(minWidth: 34, minHeight: 34);
  Widget _topBar(BuildContext c, Map room) => Padding(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4), child: Row(children: [
    IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white, size: 22), padding: EdgeInsets.zero, constraints: _tightBtn, onPressed: () => c.pop()),
    Flexible(child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [const CircleAvatar(radius: 12, backgroundColor: ZC.card), const SizedBox(width: 6),
        Flexible(child: Text('${room['name'] ?? 'Room ' + widget.rid.toString()}', overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 12)))]))),
    const SizedBox(width: 6),
    Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: ZC.purple.withValues(alpha: .4), borderRadius: BorderRadius.circular(12)),
      child: const Text('Ranking 99+', style: TextStyle(color: ZC.gold, fontSize: 11))),
    const Spacer(),
    // live voice indicator: filled when the audio channel is actually joined
    Icon(_rtcReady ? Icons.graphic_eq : Icons.volume_off,
      color: _rtcReady ? ZC.gold : Colors.white38, size: 16),
    const SizedBox(width: 6),
    const Icon(Icons.person, color: Colors.white70, size: 18), const Text(' 1', style: TextStyle(color: Colors.white70)),
    IconButton(icon: const Icon(Icons.share, color: Colors.white70, size: 20), padding: EdgeInsets.zero, constraints: _tightBtn, onPressed: () {}),
    IconButton(icon: const Icon(Icons.more_horiz, color: Colors.white70, size: 20), padding: EdgeInsets.zero, constraints: _tightBtn, onPressed: () => _roomInfo(c)),
  ]));
  /// Lucky-win / gift banner using the original ornate gold plate, with the
  /// "N Times" medallion and the lucky-bag charm layered on top. Falls back to
  /// the coin gradient if the artwork is unavailable.
  Widget _banner(String text) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    height: 46,
    child: Stack(alignment: Alignment.center, children: [
      Positioned.fill(child: Image.asset(Assets.of('room.banner.gold') ?? '', fit: BoxFit.fill,
        errorBuilder: (_, __, ___) => DecoratedBox(decoration: BoxDecoration(
          gradient: ZGrad.coin, borderRadius: BorderRadius.circular(20))))),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Row(children: [
        Image.asset(Assets.of('room.luckybag') ?? '', width: 30, height: 30,
          errorBuilder: (_, __, ___) => const Icon(Icons.card_giftcard, color: Colors.brown, size: 20)),
        const SizedBox(width: 6),
        Expanded(child: Text(text, maxLines: 2, overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700,
            shadows: [Shadow(color: Color(0xCC3A1200), blurRadius: 3, offset: Offset(0, 1))]))),
        const SizedBox(width: 4),
        Image.asset(Assets.of('room.times.100') ?? '', height: 30,
          errorBuilder: (_, __, ___) => const SizedBox.shrink()),
      ])),
    ]));

  /// My current seat (-1 when listening) and mic state, used by the bottom bar.
  int _mySeat() {
    for (final s in seats) { if (s is Map && s['uid'] == Cfg.myUid) return s['seatNo'] as int; }
    return -1;
  }
  int _myMicState() {
    final n = _mySeat();
    if (n < 0 || n >= seats.length) return 0;
    return int.tryParse('${(seats[n] as Map)['micState'] ?? 0}') ?? 0;
  }

  /// Live chat feed. Each line shows the sender's name plus their VIP / wealth
  /// badges, exactly like the original, and system lines (joins) are dimmed.
  Widget _chatFeed() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Text('All', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        const SizedBox(width: 16), const Text('Message', style: TextStyle(color: ZC.textLo)),
        const SizedBox(width: 16), const Text('Gift', style: TextStyle(color: ZC.textLo)),
        const Spacer(),
        InkWell(onTap: _showUsers, child: Row(children: [
          const Icon(Icons.people_outline, size: 15, color: ZC.textLo),
          Text(' ${users.length}', style: const TextStyle(color: ZC.textLo, fontSize: 12))])),
      ]),
      const SizedBox(height: 4),
      Expanded(child: ListView.builder(
        reverse: true,
        padding: EdgeInsets.zero,
        itemCount: chat.length,
        itemBuilder: (_, i) => _chatLine(chat[chat.length - 1 - i]),
      )),
    ]));

  Widget _chatLine(Map m) {
    if (m['system'] == true) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 2),
        child: Text('${m['nick']} ${m['text']}',
          style: const TextStyle(color: ZC.gold, fontSize: 11, fontStyle: FontStyle.italic)));
    }
    final noble = int.tryParse('${m['noble_level'] ?? 0}') ?? 0;
    final wealth = int.tryParse('${m['wealthLv'] ?? 0}') ?? 0;
    final role = '${m['role'] ?? 'user'}';
    return Padding(padding: const EdgeInsets.symmetric(vertical: 3),
      child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 4, children: [
        if (role != 'user') ZBadge(role == 'owner' ? 'OWNER' : 'ADMIN',
          role == 'owner' ? ZC.gold : ZC.purple2),
        if (wealth > 0) ZBadge('W$wealth', const Color(0xFFB03A5B)),
        if (noble > 0) NobleEmblem(noble, s: 14),
        Text('${m['nick'] ?? 'U${m['uid']}'}:',
          style: const TextStyle(color: ZC.gold2, fontSize: 12, fontWeight: FontWeight.w600)),
        Text('${m['text'] ?? ''}', style: const TextStyle(color: Colors.white, fontSize: 12)),
      ]));
  }

  /// Occupant list with the moderation actions the server will accept for my role.
  void _showUsers() => showModalBottomSheet(context: context, backgroundColor: ZC.bg2,
    builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Padding(padding: const EdgeInsets.all(12),
        child: Row(children: [
          Text('In room (${users.length})', style: ZType.section),
          const Spacer(),
          Text('you: $myRole', style: ZType.label)])),
      Flexible(child: ListView(shrinkWrap: true, children: [
        for (final u in users) ListTile(
          dense: true,
          leading: CircleAvatar(radius: 16, backgroundColor: ZC.card,
            backgroundImage: '${u['avatar'] ?? ''}'.startsWith('http')
              ? NetworkImage('${u['avatar']}') : null,
            child: '${u['avatar'] ?? ''}'.startsWith('http') ? null
              : const Icon(Icons.person, size: 16, color: ZC.textLo)),
          title: Text('${u['nick'] ?? 'U${u['uid']}'}',
            style: const TextStyle(color: Colors.white, fontSize: 14)),
          subtitle: Text('${u['role'] ?? 'user'}', style: ZType.label.copyWith(fontSize: 11)),
          trailing: _userActions(u),
        )])),
    ])));

  /// Only render actions my role is allowed to perform; the server re-checks.
  Widget? _userActions(Map u) {
    final target = int.tryParse('${u['uid']}') ?? 0;
    if (target == Cfg.myUid || !isStaff) return null;
    final targetRole = '${u['role'] ?? 'user'}';
    if (targetRole == 'owner') return null;
    return PopupMenuButton<String>(
      color: ZC.bg2, icon: const Icon(Icons.more_horiz, color: ZC.textLo, size: 18),
      onSelected: (v) {
        switch (v) {
          case 'mute':   socket.muteUser(widget.rid, Cfg.myUid, target, true); break;
          case 'unmute': socket.muteUser(widget.rid, Cfg.myUid, target, false); break;
          case 'off':    socket.leaveSeat(widget.rid, Cfg.myUid, targetUid: target); break;
          case 'kick':   socket.kickUser(widget.rid, Cfg.myUid, target); break;
          case 'admin':  socket.setAdmin(widget.rid, Cfg.myUid, target, targetRole != 'admin'); break;
        }
        Navigator.of(context).maybePop();
      },
      itemBuilder: (_) => [
        const PopupMenuItem(value: 'mute', child: Text('Mute', style: TextStyle(color: Colors.white))),
        const PopupMenuItem(value: 'unmute', child: Text('Unmute', style: TextStyle(color: Colors.white))),
        const PopupMenuItem(value: 'off', child: Text('Remove from seat', style: TextStyle(color: Colors.white))),
        // owner-only entries
        if (myRole == 'owner')
          PopupMenuItem(value: 'admin', child: Text(targetRole == 'admin' ? 'Revoke admin' : 'Make admin',
            style: const TextStyle(color: Colors.white))),
        if (myRole == 'owner')
          const PopupMenuItem(value: 'kick', child: Text('Kick', style: TextStyle(color: ZC.danger))),
      ]);
  }

  void _sendChat() {
    final t = _chatCtl.text.trim();
    if (t.isEmpty) return;
    socket.chat(widget.rid, Cfg.myUid, t);
    _chatCtl.clear();
  }

  Widget _bottomBar(BuildContext c) => Padding(padding: const EdgeInsets.all(8), child: Row(children: [
    // Live composer — sends through the socket; the server rejects it with
    // action_denied ("muted") when staff have muted me.
    Expanded(child: Container(height: 40, padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(20)),
      child: TextField(controller: _chatCtl, textInputAction: TextInputAction.send,
        onSubmitted: (_) => _sendChat(), style: const TextStyle(color: Colors.white, fontSize: 13),
        decoration: const InputDecoration(border: InputBorder.none, isDense: true,
          hintText: 'Say Hi', hintStyle: TextStyle(color: ZC.textLo))))),
    IconButton(icon: const Icon(Icons.send, color: Colors.white), onPressed: _sendChat),
    // Mic toggles my own seat; when I'm only listening it asks staff for a mic.
    IconButton(
      icon: Icon(_mySeat() < 0 ? Icons.pan_tool_alt_outlined
              : (_myMicState() == 1 ? Icons.mic_off : Icons.mic), color: Colors.white),
      onPressed: () => _mySeat() < 0
        ? socket.requestMic(widget.rid, Cfg.myUid)
        : socket.setMic(widget.rid, _mySeat(), _myMicState() == 1 ? 0 : 1, Cfg.myUid)),
    IconButton(icon: const Icon(Icons.card_giftcard, color: ZC.gold), onPressed: () => _giftPanel(c)),
  ]));

  void _giftPanel(BuildContext c) => showModalBottomSheet(context: c, backgroundColor: ZC.bg2, isScrollControlled: true,
    builder: (_) => GiftPanel(onSend: _sendGift));
  void _roomInfo(BuildContext c) => showModalBottomSheet(context: c, backgroundColor: ZC.bg2, builder: (_) => Padding(padding: const EdgeInsets.all(16),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Room information', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)), const SizedBox(height: 12),
      _info('Room ID', '${widget.rid}'), _info('Room mode', 'Voice chat room'), _info('Room country', 'Belgium'), _info('Room decoration', '›'),
    ])));
  Widget _info(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Row(children: [Text(k, style: const TextStyle(color: Colors.white)), const Spacer(), Text(v, style: const TextStyle(color: ZC.textLo))]));
}

/// Gift panel sheet — real gifts from gift.getGiftList, selectable + qty + Send.
/// Selecting a gift and Send drives the REAL engine (svga/pag), no mock.
class GiftPanel extends ConsumerStatefulWidget {
  final void Function(GiftDef def, int qty) onSend;
  const GiftPanel({super.key, required this.onSend});
  @override ConsumerState<GiftPanel> createState() => _GiftPanelState();
}

class _GiftPanelState extends ConsumerState<GiftPanel> {
  int _sel = -1;
  int _qty = 1;
  static const _qtys = [1, 10, 99, 520, 1314];

  List<GiftDef> _filter(List<GiftDef> all, int tab) {
    switch (tab) {
      case 1: return all.where((g) => g.coinType == 1).toList();          // Gift (coins)
      case 2: return all.where((g) => g.name.toLowerCase().contains('luck') || g.name.toLowerCase().contains('bag')).toList();
      case 3: return all.where((g) => g.price >= 1000).toList();          // Aristocracy
      case 4: return all.where((g) => g.name.toLowerCase().contains('cp') || g.name.toLowerCase().contains('heart')).toList();
      default: return all;                                                // Commonly = all
    }
  }

  @override Widget build(BuildContext c) {
    final async = ref.watch(giftsProvider);
    final me = ref.watch(meProvider);
    final coins = me.asData?.value.coins ?? 0;
    return DefaultTabController(length: 5, child: SizedBox(height: 400, child: async.when(
      loading: () => const Center(child: CircularProgressIndicator(color: ZC.gold)),
      error: (e, _) => Center(child: Text('gift.getGiftList: $e', style: const TextStyle(color: ZC.textLo))),
      data: (rows) {
        final all = rows.whereType<Map>().map((m) => GiftDef.fromApi(m)).where((g) => g.giftId != 0).toList();
        final defById = {for (final g in all) g.giftId: g};
        return Column(children: [
          const TabBar(isScrollable: true, indicatorColor: ZC.gold, labelColor: ZC.gold, unselectedLabelColor: ZC.textLo,
            tabs: [Tab(text: 'Commonly'), Tab(text: 'Gift'), Tab(text: 'Lucky'), Tab(text: 'Aristocracy'), Tab(text: 'CP')]),
          Expanded(child: TabBarView(children: [for (int t = 0; t < 5; t++) _grid(_filter(all, t))])),
          _bar(c, coins, defById),
        ]);
      },
    )));
  }

  Widget _grid(List<GiftDef> gifts) {
    if (gifts.isEmpty) return const Center(child: Text('No gifts here', style: TextStyle(color: ZC.textLo)));
    return GridView.count(crossAxisCount: 4, padding: const EdgeInsets.all(12), childAspectRatio: .72, mainAxisSpacing: 8, crossAxisSpacing: 8,
      children: [for (final g in gifts) _cell(g)]);
  }

  Widget _cell(GiftDef g) {
    final on = _sel == g.giftId;
    return InkWell(onTap: () => setState(() => _sel = g.giftId), child: Container(
      decoration: BoxDecoration(
        color: on ? ZC.purple.withValues(alpha: .25) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: on ? ZC.gold : Colors.transparent)),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Expanded(child: g.icon.startsWith('http')
          ? Image.network(g.icon, errorBuilder: (_, __, ___) => const Icon(Icons.card_giftcard, color: ZC.gold, size: 30))
          : Icon(Icons.card_giftcard, color: g.priority.rank >= GiftPriority.legendary.rank ? ZC.gold2 : ZC.gold, size: 30)),
        Text(g.name, style: const TextStyle(color: Colors.white, fontSize: 11), overflow: TextOverflow.ellipsis, maxLines: 1),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(g.coinType == 2 ? Icons.diamond : Icons.monetization_on, size: 11, color: g.coinType == 2 ? ZC.diamond : ZC.coin),
          Text(' ${g.price}', style: const TextStyle(color: ZC.gold, fontSize: 11))]),
      ]),
    ));
  }

  Widget _bar(BuildContext c, int coins, Map<int, GiftDef> defById) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), color: ZC.bg, child: Row(children: [
      const CoinIcon(s: 18), Text(' $coins', style: const TextStyle(color: ZC.gold)), const SizedBox(width: 8),
      InkWell(onTap: () => c.push('/wallet'), child: const Text('Recharge', style: TextStyle(color: ZC.purple2, fontSize: 12))),
      const Spacer(),
      PopupMenuButton<int>(
        color: ZC.bg2, initialValue: _qty, onSelected: (v) => setState(() => _qty = v),
        itemBuilder: (_) => [for (final q in _qtys) PopupMenuItem(value: q, child: Text('x$q', style: const TextStyle(color: Colors.white)))],
        child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(border: Border.all(color: ZC.textLo), borderRadius: BorderRadius.circular(6)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [Text('$_qty', style: const TextStyle(color: Colors.white)), const Icon(Icons.arrow_drop_down, color: ZC.textLo, size: 18)])),
      ),
      const SizedBox(width: 8),
      ElevatedButton(
        onPressed: _sel < 0 ? null : () { widget.onSend(defById[_sel]!, _qty); Navigator.pop(c); },
        style: ElevatedButton.styleFrom(backgroundColor: ZC.purple, disabledBackgroundColor: ZC.card, shape: const StadiumBorder()),
        child: const Text('Send')),
    ]));
}
