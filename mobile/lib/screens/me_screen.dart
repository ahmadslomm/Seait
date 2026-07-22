import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../models/user.dart';
import '../ui/components.dart';

/// Me / Profile — reproduces screenshot 193434, wired to REAL user.getUserinfo.
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});
  @override
  Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return Scaffold(
      backgroundColor: ZC.bg,
      body: me.when(
        loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => Center(child: Padding(padding: const EdgeInsets.all(24),
          child: Text('API user.getUserinfo:\n$e', textAlign: TextAlign.center, style: const TextStyle(color: ZC.textLo)))),
        data: (u) => _body(c, u),
      ),
    );
  }

  Widget _body(BuildContext c, UserModel u) => SingleChildScrollView(child: Column(children: [
    Stack(clipBehavior: Clip.none, children: [
      Container(height: 250, decoration: const BoxDecoration(gradient: LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF3E2064), Color(0xFF2A1148), ZC.bg]))),
      Positioned(left: 16, top: 54, child: Row(children: [
        Text(u.nick.isEmpty ? 'ZaffaLive' : u.nick, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(width: 6), const Icon(Icons.edit, color: ZC.textLo, size: 16)])),
      Positioned(left: 16, top: 90, child: Row(children: [
        Text('ID:${u.uid}', style: const TextStyle(color: ZC.textLo)), const SizedBox(width: 4), const Icon(Icons.copy, size: 13, color: ZC.textLo)])),
      Positioned(left: 16, top: 124, child: Row(children: [
        if (u.nationalFlag.isNotEmpty) Padding(padding: const EdgeInsets.only(right: 6),
          child: ClipRRect(borderRadius: BorderRadius.circular(3), child: CachedNetworkImage(imageUrl: u.nationalFlag, width: 26, height: 17, fit: BoxFit.cover, errorWidget: (_, __, ___) => const SizedBox(width: 26)))),
        ZBadge('W${u.wealthLv}', const Color(0xFFB03A5B), icon: Icons.shield), const SizedBox(width: 5),
        ZBadge('${u.charmLv + 12}', const Color(0xFF1E9E9E), icon: Icons.spa), const SizedBox(width: 5),
        ZBadge('${u.activeLevel}', ZC.gold, icon: Icons.star), const SizedBox(width: 5),
        ZBadge('${u.nobleLevel}', const Color(0xFF3A2A5C), icon: Icons.emoji_events)])),
      Positioned(right: 6, top: 30, child: const VipMedallion(s: 150)),
    ]),
    Padding(padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8), child: Row(children: [
      _stat('${u.fans}', 'Followers'), _stat('${u.following}', 'Following'), _stat('${u.gifts}', 'Gifts'), _stat('100', 'Visitors')])),
    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: InkWell(onTap: () => c.push('/vip'),
      child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient: ZGrad.vip,
        borderRadius: BorderRadius.circular(16), border: Border.all(color: ZC.gold, width: 1.5),
        boxShadow: const [BoxShadow(color: Color(0x557B2FF7), blurRadius: 14, offset: Offset(0, 6))]),
      child: Row(children: [
        const Icon(Icons.workspace_premium, color: ZC.gold2, size: 42), const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('VIP ${u.nobleLevel}', style: const TextStyle(color: ZC.gold2, fontSize: 26, fontWeight: FontWeight.bold)),
          const Text('Welcome Back VIP', style: TextStyle(color: Colors.white70))]),
        const Spacer(),
        Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(border: Border.all(color: ZC.gold), borderRadius: BorderRadius.circular(20)),
          child: const Text('My Benefits', style: TextStyle(color: ZC.gold2, fontWeight: FontWeight.bold)))])))),
    const SizedBox(height: 12),
    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: [
      Expanded(child: WalletCard(label: 'Coins', value: '89', onTap: () => c.push('/wallet'))),
      const SizedBox(width: 12),
      Expanded(child: WalletCard(label: 'Diamonds', value: '57551', diamond: true, onTap: () => c.push('/wallet')))])),
    const SizedBox(height: 12),
    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Container(
      padding: const EdgeInsets.symmetric(vertical: 16), decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(16)),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
        _gi(c, Icons.storefront, 'Store', const Color(0xFFE8862E), null),
        _gi(c, Icons.assignment, 'Task', const Color(0xFF3FA34D), '/tasks'),
        _gi(c, Icons.event_available, 'Check in', ZC.purple2, '/tasks'),
        _gi(c, Icons.backpack, 'Backpack', ZC.gold, '/backpack')]))),
    const SizedBox(height: 12),
    _tile(c, Icons.favorite, 'Cp space', '/cp'), _tile(c, Icons.workspace_premium, 'My level', '/level'),
    _tile(c, Icons.groups, 'Guild', '/guild'), _tile(c, Icons.business_center, 'Agency', '/agency'),
    _tile(c, Icons.trending_up, 'My income', null), _tile(c, Icons.military_tech, 'Badge', null),
    _tile(c, Icons.feedback, 'Feedback', null), _tile(c, Icons.settings, 'Settings', null),
    const SizedBox(height: 20),
  ]));

  Widget _stat(String v, String l) => Expanded(child: Column(children: [
    Text(v, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
    Text(l, style: const TextStyle(color: ZC.textLo, fontSize: 12))]));
  Widget _gi(BuildContext c, IconData i, String l, Color color, String? route) => InkWell(
    onTap: route == null ? null : () => c.push(route),
    child: Column(children: [
      Container(width: 52, height: 52, decoration: BoxDecoration(gradient: LinearGradient(colors: [color.withOpacity(.95), color.withOpacity(.7)],
        begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(14)),
        child: Icon(i, color: Colors.white, size: 26)), const SizedBox(height: 6),
      Text(l, style: const TextStyle(color: Colors.white, fontSize: 12))]));
  Widget _tile(BuildContext c, IconData i, String t, String? route) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
    child: InkWell(onTap: route == null ? null : () => c.push(route), borderRadius: BorderRadius.circular(12),
      child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [Icon(i, color: ZC.purple2, size: 22), const SizedBox(width: 12),
          Text(t, style: const TextStyle(color: Colors.white, fontSize: 15)), const Spacer(),
          const Icon(Icons.chevron_right, color: ZC.textLo)]))));
}
