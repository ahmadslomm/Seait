import 'package:flutter_test/flutter_test.dart';
import 'package:seait/gift_engine/gift_models.dart';
import 'package:seait/gift_engine/gift_queue.dart';
import 'package:seait/gift_engine/gift_engine.dart';

// Rows shaped exactly like the real gift.getGiftList response (backend seed).
Map _row(int id, String name, int price, int ct, int animType, String url, {bool full = false}) =>
    {'gift_id': id, 'name': name, 'price': price, 'coin_type': ct, 'anim_type': animType, 'anim_url': url, 'fullscreen': full};

GiftEvent _ev(GiftDef d, {int sender = 1, int? target, int count = 1, int room = 7}) =>
    GiftEvent(def: d, senderUid: sender, targetUid: target, roomId: room, count: count);

void main() {
  group('GiftDef.fromApi — real-field classification (req 4/7/8)', () {
    test('Rose (no art) → image renderer, NORMAL, over-seat, empty url (→ logged)', () {
      final d = GiftDef.fromApi(_row(1, 'Rose', 10, 1, 0, ''));
      expect(d.renderer, GiftRenderer.image);
      expect(d.priority, GiftPriority.normal);
      expect(d.display, GiftDisplay.overSeat);
      expect(d.animUrl, '');
      expect(d.hasAnimation, false);
    });
    test('Lucky Bag → SVGA renderer, RARE', () {
      final d = GiftDef.fromApi(_row(2, 'Lucky Bag', 99, 1, 1, 'assets/svga/kroom/waitio_lucky_gift.svga'));
      expect(d.renderer, GiftRenderer.svga);
      expect(d.priority, GiftPriority.rare);
      expect(d.resolvedUrl, '../assets/svga/kroom/waitio_lucky_gift.svga'); // asset-key normalisation
    });
    test('CP Heart → PAG renderer, avatar-band', () {
      final d = GiftDef.fromApi(_row(5, 'CP Heart', 520, 2, 2, 'assets/pag/cp/waitio_cp_heart.pag'));
      expect(d.renderer, GiftRenderer.pag);
      expect(d.display, GiftDisplay.avatarAnim);
    });
    test('Rocket → fullscreen, LEGENDARY', () {
      final d = GiftDef.fromApi(_row(7, 'Rocket', 5000, 2, 1, 'assets/svga/rocket/waitio_room_rocket.svga', full: true));
      expect(d.display, GiftDisplay.fullscreen);
      expect(d.priority, GiftPriority.legendary);
    });
    test('Crown of Glory → LEGENDARY, Angel Scepter → SUPER', () {
      expect(GiftDef.fromApi(_row(9, 'Crown of Glory', 14999, 2, 1, 'assets/svga/rocket/waitio_rocket_top1.svga', full: true)).priority, GiftPriority.legendary);
      expect(GiftDef.fromApi(_row(10, 'Angel Scepter', 19999, 2, 1, 'assets/svga/rocket/waitio_rocket_top2.svga', full: true)).priority, GiftPriority.sup);
    });
    test('renderer resolves by extension then by anim_type hint', () {
      expect(GiftDef.fromApi(_row(1, 'x', 1, 1, 0, 'http://cdn/x.pag')).renderer, GiftRenderer.pag);
      expect(GiftDef.fromApi(_row(1, 'x', 1, 1, 2, '')).renderer, GiftRenderer.pag); // no url → hint
    });
    test('http url passes through resolvedUrl unchanged', () {
      expect(GiftDef.fromApi(_row(1, 'x', 1, 1, 1, 'https://cdn/x.svga')).resolvedUrl, 'https://cdn/x.svga');
    });
  });

  group('GiftQueue — priority order + combo merge (req 4/5/7)', () {
    final normal = GiftDef.fromApi(_row(1, 'Rose', 10, 1, 1, 'a.svga'));   // rare? -> make normal
    final vip = GiftDef.fromApi(_row(2, 'Vip', 1200, 1, 1, 'v.svga'));
    final sup = GiftDef.fromApi(_row(3, 'Sup', 20000, 2, 1, 's.svga', full: true));

    test('polls highest priority first regardless of insert order', () {
      final q = GiftQueue();
      q.add(_ev(vip, sender: 2));
      q.add(_ev(sup, sender: 3));
      q.add(_ev(normal, sender: 4));
      expect(q.poll()!.def.name, 'Sup');
      expect(q.poll()!.def.name, 'Vip');
      expect(q.poll()!.def.name, 'Rose');
    });
    test('same combo run merges (bump count, no duplicate enqueue)', () {
      final q = GiftQueue();
      expect(q.add(_ev(vip, sender: 2, target: 9)), isNull); // fresh insert
      final merged = q.add(_ev(vip, sender: 2, target: 9)); // same key
      expect(merged, isNotNull);
      expect(q.length, 1);
      expect(merged!.count, 2);
    });
  });

  group('GiftEngine — feature/toast/combo/priority (req 4/5/11)', () {
    test('small gift → concurrent toast; repeat bumps combo, no replay', () {
      final e = GiftEngine();
      final rose = GiftDef.fromApi(_row(1, 'Rose', 10, 1, 0, '')); // over-seat
      for (var i = 0; i < 12; i++) {
        e.receive(_ev(rose, sender: 1, target: 5));
      }
      expect(e.toasts.length, 1);          // one animation, not 12
      expect(e.toasts.first.count, 12);    // combo x12
    });
    test('big gift occupies single feature slot; combo bumps it', () {
      final e = GiftEngine();
      final crown = GiftDef.fromApi(_row(9, 'Crown of Glory', 14999, 2, 1, 'c.svga', full: true));
      e.receive(_ev(crown, sender: 1, target: 5));
      e.receive(_ev(crown, sender: 1, target: 5));
      e.receive(_ev(crown, sender: 1, target: 5));
      expect(e.feature!.def.name, 'Crown of Glory');
      expect(e.feature!.count, 3);
    });
    test('feature queue drains by priority', () {
      final e = GiftEngine();
      final a = GiftDef.fromApi(_row(1, 'A', 5000, 2, 1, 'a.svga', full: true)); // legendary
      final b = GiftDef.fromApi(_row(2, 'B', 20000, 2, 1, 'b.svga', full: true)); // super
      e.receive(_ev(a, sender: 1));        // becomes feature immediately
      e.receive(_ev(b, sender: 2));        // queued (higher priority, waits)
      expect(e.feature!.def.name, 'A');
      e.completeFeature();
      expect(e.feature!.def.name, 'B');    // super plays next
      e.completeFeature();
      expect(e.feature, isNull);
    });
    test('up to 3 concurrent toasts (several gifts at once, req 11)', () {
      final e = GiftEngine();
      for (var i = 0; i < 5; i++) {
        e.receive(_ev(GiftDef.fromApi(_row(100 + i, 'g$i', 10, 1, 0, '')), sender: 100 + i, target: i));
      }
      expect(e.toasts.length, 3); // capped, oldest dropped
    });
  });
}
