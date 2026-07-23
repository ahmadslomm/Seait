import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:seait/core/theme.dart';
import 'package:seait/ui/components.dart';

void main() {
  testWidgets('design-system smoke: ZCard + EmptyState render on the dark theme', (tester) async {
    await tester.pumpWidget(ProviderScope(child: MaterialApp(
      theme: ZTheme.dark,
      home: const Scaffold(body: ZCard(child: EmptyState(text: 'no data'))),
    )));
    expect(find.text('no data'), findsOneWidget);
  });
}
