import os
R="/root/Seait/mobile/lib"
def w(p,c):
    f=os.path.join(R,p)
    if os.path.exists(f): os.remove(f)
    open(f,"w").write(c.lstrip("\n"))

H="""import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers.dart';
import '../ui/components.dart';
"""

# helper: turn a riverpod AsyncValue into a widget via when()
ASYNC="""
  Widget _async(AsyncValue v, Widget Function(dynamic) b, {String empty='Nothing here'}) => v.when(
    loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
    error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
    data: (d) => (d is List && d.isEmpty) ? EmptyState(text: empty) : b(d));
"""

# ---------------- WALLET ----------------
w("screens/wallet_screen.dart", H+r"""
/// Wallet — Coins & Diamonds from user.getUserinfo; exchange + recharge lists.
class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return ZPage(title: 'Wallet', tabs: const ['Coins', 'Diamonds'], tabViews: [
      me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
        data: (u) => _coins(u.coins)),
      me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
        data: (u) => _diamonds(u.diamonds)),
    ], body: const SizedBox());
  }
  Widget _coins(int coins) => ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
    ZCard(gradient: ZGrad.coin, child: Row(children: [const CoinIcon(s: 40), const SizedBox(width: ZSpace.md),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('My Coins', style: TextStyle(color: Colors.brown.shade800, fontWeight: FontWeight.w700)),
        Text('$coins', style: TextStyle(color: Colors.brown.shade900, fontSize: 26, fontWeight: FontWeight.bold))])])),
    const SectionHeader('Recharge'),
    for (final r in const [[50000,'0.99'],[250000,'4.99'],[1000000,'20.99'],[2500000,'54.99'],[5000000,'104.99'],[10000000,'209.99']])
      ZCard(padding: const EdgeInsets.symmetric(horizontal: ZSpace.lg, vertical: ZSpace.md), child: Row(children: [
        const CoinIcon(s: 20), const SizedBox(width: ZSpace.sm), Text('${r[0]}', style: ZType.body), const Spacer(),
        Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), decoration: BoxDecoration(gradient: ZGrad.vip, borderRadius: BorderRadius.circular(ZRadius.lg)), child: Text('${r[1]} €', style: const TextStyle(color: ZC.textHi))) ])),
  ]);
  Widget _diamonds(int dia) => ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
    ZCard(gradient: ZGrad.dia, child: Row(children: [const DiamondIcon(s: 40), const SizedBox(width: ZSpace.md),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('My Diamonds', style: TextStyle(color: Colors.deepPurple.shade900, fontWeight: FontWeight.w700)),
        Text('$dia', style: TextStyle(color: Colors.deepPurple.shade900, fontSize: 26, fontWeight: FontWeight.bold))])])),
    const SectionHeader('Exchange for gold coins  (2 💎 = 1 🪙)'),
    Wrap(spacing: ZSpace.sm, runSpacing: ZSpace.sm, children: [for (final v in const [500000,1500000,2500000,5000000,7500000,10000000])
      Container(width: 100, padding: const EdgeInsets.all(ZSpace.md), decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(ZRadius.md)), child: Center(child: Text('$v', style: ZType.label.copyWith(color: ZC.gold))))]),
  ]);
}
""")

# ---------------- MINE / BACKPACK (decorations) ----------------
w("screens/backpack_screen.dart", H+r"""
/// Backpack / Mine — decorations: Frame/Ride/Entry/Bubble/Profile Card. Loads mall.getMyProduct.
class BackpackScreen extends ConsumerWidget {
  const BackpackScreen({super.key});
  static const cats = ['Frame','Ride','Entry effect','Bubble','Profile Card'];
  @override Widget build(BuildContext c, WidgetRef ref) {
    final inv = ref.watch(actionProvider((action: 'mall.getMyProduct', params: {})));
    return ZPage(title: 'Backpack', tabs: cats, tabViews: [ for (final cat in cats)
      inv.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API mall.getMyProduct:\n$e'),
        data: (d) { final list = (d is List) ? d : []; return list.isEmpty
          ? EmptyState(icon: Icons.backpack, text: 'No $cat yet\n(mall.getMyProduct returned empty — logged)')
          : GridView.count(crossAxisCount: 2, padding: const EdgeInsets.all(ZSpace.md), childAspectRatio: 1.2,
            children: [for (final it in list) ZCard(child: Center(child: Text('$it', style: ZType.body)))]); }),
    ], body: const SizedBox());
  }
}
""")

# ---------------- LIVE (stream grid) ----------------
w("screens/live_screen.dart", H+r"""
/// Live — stream grid. Loads Action/LiveRoom.recommend (unknown schema → logged).
class LiveScreen extends ConsumerWidget {
  const LiveScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final live = ref.watch(actionProvider((action: 'Action/LiveRoom.recommend', params: {'page': 1})));
    return ZPage(title: 'Live', tabs: const ['Popular','Follow'], tabViews: [
      live.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e, _) => EmptyState(icon: Icons.cloud_off, text: 'API LiveRoom.recommend:\n$e'),
        data: (d) { final list = (d is Map ? d['list'] : d) as List? ?? [];
          return list.isEmpty ? const EmptyState(icon: Icons.videocam_off, text: 'No live rooms yet\n(logged for discovery)')
          : GridView.count(crossAxisCount: 2, padding: const EdgeInsets.all(ZSpace.md), childAspectRatio: .72, mainAxisSpacing: ZSpace.md, crossAxisSpacing: ZSpace.md,
            children: [for (final r in list) ZCard(padding: EdgeInsets.zero, child: Center(child: Text('$r', style: ZType.label)))]); }),
      const EmptyState(icon: Icons.people_outline, text: 'No followed lives'),
    ], body: const SizedBox());
  }
}
""")

# ---------------- MESSAGE ----------------
w("screens/message_screen.dart", H+r"""
/// Message — conversations + friends. Loads notice.checkNotice / IM (unknown → logged).
class MessageScreen extends ConsumerWidget {
  const MessageScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final msg = ref.watch(actionProvider((action: 'notice.checkNotice', params: {})));
    return ZPage(title: 'Message', tabs: const ['Chat','Friends'], tabViews: [
      ListView(children: [
        for (final s in const [['System',Icons.campaign],['Relationship',Icons.favorite],['Reward Assistant',Icons.card_giftcard],['New followers',Icons.person_add],['Official Assistant',Icons.verified]])
          ZListTile(s[1] as IconData, s[0] as String, onTap: () {}),
        msg.when(loading: () => const SizedBox(), error: (e,_) => Padding(padding: const EdgeInsets.all(ZSpace.lg), child: Text('IM/notice: $e', style: ZType.label)), data: (_) => const SizedBox()),
      ]),
      const EmptyState(icon: Icons.group, text: 'No friends yet'),
    ], body: const SizedBox());
  }
}
""")

# ---------------- SEARCH ----------------
w("screens/search_screen.dart", H+r"""
/// Search users. Loads user.search style action (unknown → logged).
class SearchScreen extends ConsumerWidget {
  const SearchScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final rec = ref.watch(actionProvider((action: 'user.batchGetUserinfoV2', params: {})));
    return Scaffold(backgroundColor: ZC.bg, appBar: AppBar(title: Container(height: 38, padding: const EdgeInsets.symmetric(horizontal: ZSpace.md),
      decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(ZRadius.pill)),
      child: const Row(children: [Icon(Icons.search, color: ZC.textLo, size: 18), SizedBox(width: 6), Text('Search for users', style: TextStyle(color: ZC.textLo))]))),
      body: ListView(children: [
        const SectionHeader('People you may like'),
        rec.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
          error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
          data: (d) { final list = (d is List) ? d : []; return list.isEmpty
            ? const Padding(padding: EdgeInsets.all(ZSpace.lg), child: Text('(no suggestions — logged)', style: TextStyle(color: ZC.textLo)))
            : Column(children: [for (final u in list) ZListTile(Icons.person, '$u')]); }),
      ]));
  }
}
""")

# ---------------- MOMENT (feed) ----------------
w("screens/moment_screen.dart", H+r"""
/// Moment — feed. Loads moment.recomV3.
class MomentScreen extends ConsumerWidget {
  const MomentScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final feed = ref.watch(actionProvider((action: 'moment.recomV3', params: {'page': 1})));
    return ZPage(title: 'Moment', tabs: const ['Follow','Recommend','Latest'], tabViews: [
      const EmptyState(icon: Icons.pets, text: "You haven't followed anybody yet"),
      feed.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
        error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API moment.recomV3:\n$e'),
        data: (d) { final list = (d is Map ? d['list'] : d) as List? ?? [];
          return list.isEmpty ? const EmptyState(icon: Icons.pets, text: 'No moments yet') : ListView(children: [for (final m in list) ZListTile(Icons.article, '$m')]); }),
      const EmptyState(icon: Icons.schedule, text: 'Latest'),
    ], body: const SizedBox());
  }
}
""")

# ---------------- CP ----------------
w("screens/cp_screen.dart", H+r"""
/// CP space — from user.getUserinfo.cp_info (real: partner 1150147, sweet 4887591).
class CpScreen extends ConsumerWidget {
  const CpScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return Scaffold(backgroundColor: const Color(0xFF2A0E2E), appBar: AppBar(title: const Text('CP space')),
      body: me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.pink)),
        error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
        data: (u) { final cp = u.cpInfo; final has = (cp['hasCp'] ?? 0) == 1; return ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
          Center(child: Column(children: [
            const Icon(Icons.favorite, color: ZC.pink, size: 80),
            Text('Sweet ${cp['sweet_value'] ?? 0}', style: const TextStyle(color: ZC.pink, fontSize: 20, fontWeight: FontWeight.bold)),
            Text('${cp['days'] ?? 0} days', style: ZType.label),
            const SizedBox(height: ZSpace.sm),
            Text(has ? 'CP privilege · Lv.${cp['cp_lv'] ?? 0}' : 'No CP yet', style: ZType.body)])),
          const SectionHeader('Confession wall'),
          GridView.count(crossAxisCount: 4, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: .8,
            children: [for (int i=0;i<8;i++) GiftCell(name: 'Gift', price: (i+1)*100, onTap: () {})]),
        ]); }));
  }
}
""")

# ---------------- GUILD ----------------
w("screens/guild_screen.dart", H+r"""
/// Guild — from user.getUserinfo.guild_info (real guild 12147).
class GuildScreen extends ConsumerWidget {
  const GuildScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return ZPage(title: 'Guild', body: me.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
      error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API: $e'),
      data: (u) { final g = u.guildInfo; return ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
        ZCard(gradient: ZGrad.vip, border: ZC.gold, child: Row(children: [
          const Icon(Icons.groups, color: ZC.gold2, size: 44), const SizedBox(width: ZSpace.md),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${g['name'] ?? 'No guild'}', style: ZType.section.copyWith(color: ZC.gold2)),
            Text('Guild ID: ${g['guild_id'] ?? '-'}  ·  Anchors: ${g['anchorNum'] ?? 0}', style: ZType.label)]))])),
        const SectionHeader('Members'),
        const EmptyState(icon: Icons.people, text: 'Members via Action/Anchor.* (logged)'),
      ]); }));
  }
}
""")

# ---------------- AGENCY ----------------
w("screens/agency_screen.dart", H+r"""
class AgencyScreen extends ConsumerWidget {
  const AgencyScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final a = ref.watch(actionProvider((action: 'Action/BDCenter.inviteUserRes', params: {})));
    return ZPage(title: 'Agency', body: a.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
      error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API BDCenter:\n$e'),
      data: (_) => const EmptyState(icon: Icons.business_center, text: 'Agency center (BDCenter.* — logged)')));
  }
}
""")

# ---------------- TASKS ----------------
w("screens/tasks_screen.dart", H+r"""
/// Tasks — task.getSignInListV3 (real action name; unknown schema → logged).
class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key});
  @override Widget build(BuildContext c, WidgetRef ref) {
    final t = ref.watch(actionProvider((action: 'task.getSignInListV3', params: {})));
    return ZPage(title: 'Tasks', body: t.when(loading: () => const Center(child: CircularProgressIndicator(color: ZC.purple)),
      error: (e,_) => EmptyState(icon: Icons.cloud_off, text: 'API task.getSignInListV3:\n$e'),
      data: (d) { final list = (d is List) ? d : []; return list.isEmpty
        ? const EmptyState(icon: Icons.assignment_turned_in, text: 'No tasks (logged)')
        : ListView(children: [for (final task in list) ZListTile(Icons.check_circle, '$task', trailingText: 'Go')]); }));
  }
}
""")
print("all screens generated")
