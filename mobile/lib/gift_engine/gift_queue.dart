import 'gift_models.dart';

/// Priority queue for gift events (req 4 "Queue حسب priority", req 5 combo).
///
/// Rules:
///  • Ordered by [GiftPriority] rank (SUPER first), FIFO within the same rank.
///  • Combo: if an incoming event shares a comboKey with an event already
///    waiting in the queue, we bump that event's [count] instead of enqueuing
///    a duplicate — the animation is never re-queued for a combo.
///  • The engine additionally routes combos onto the *currently playing* event
///    (see GiftEngine) so an ongoing animation just increments its counter.
class GiftQueue {
  final List<GiftEvent> _q = [];

  bool get isEmpty => _q.isEmpty;
  int get length => _q.length;

  /// Returns the event a combo-hit landed on (already-queued), or null if the
  /// event was freshly inserted.
  GiftEvent? add(GiftEvent e) {
    // combo merge against pending events
    for (final p in _q) {
      if (p.comboKey == e.comboKey) {
        p.count += e.count;
        return p;
      }
    }
    // priority-ordered insert (higher rank first, stable/FIFO within rank)
    var i = 0;
    while (i < _q.length && _q[i].priority.rank >= e.priority.rank) {
      i++;
    }
    _q.insert(i, e);
    return null;
  }

  /// Highest-priority next event, or null.
  GiftEvent? poll() => _q.isEmpty ? null : _q.removeAt(0);

  /// Peek without removing.
  GiftEvent? get head => _q.isEmpty ? null : _q.first;

  /// A higher-priority event is waiting than the one supplied (for pre-emption).
  bool hasHigherThan(GiftPriority p) => _q.isNotEmpty && _q.first.priority.rank > p.rank;

  void clear() => _q.clear();
}
