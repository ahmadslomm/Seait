import 'package:flutter_test/flutter_test.dart';
import 'package:seait/providers.dart';

/// Guards the defect that made Live/Message/Search/Backpack/Tasks/Agency hang on
/// their spinners: a Riverpod family key holding a Map literal is never equal to
/// itself across rebuilds, so the provider is re-created every frame.
void main() {
  test('identical calls built separately are equal (provider is reused)', () {
    final a = ApiCall('moment.recomV3', {'page': 1});
    final b = ApiCall('moment.recomV3', {'page': 1});
    expect(a, equals(b));
    expect(a.hashCode, equals(b.hashCode));
  });

  test('a raw record with a Map literal is NOT equal — the original bug', () {
    final a = (action: 'moment.recomV3', params: {'page': 1});
    final b = (action: 'moment.recomV3', params: {'page': 1});
    expect(a == b, isFalse, reason: 'Map literals have no value equality');
  });

  test('key order does not affect equality', () {
    expect(ApiCall('x', {'a': 1, 'b': 2}), equals(ApiCall('x', {'b': 2, 'a': 1})));
  });

  test('different action or params produce different keys', () {
    expect(ApiCall('x'), isNot(equals(ApiCall('y'))));
    expect(ApiCall('x', {'page': 1}), isNot(equals(ApiCall('x', {'page': 2}))));
  });

  test('no-arg and empty-map forms are the same key', () {
    expect(ApiCall('x'), equals(ApiCall('x', {})));
  });

  test('params are unmodifiable so a key cannot mutate after construction', () {
    final c = ApiCall('x', {'page': 1});
    expect(() => c.params['page'] = 2, throwsUnsupportedError);
  });
}
