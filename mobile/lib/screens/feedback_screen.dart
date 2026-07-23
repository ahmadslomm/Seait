import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../ui/components.dart';

/// Feedback — submits to feedback.report.
///
/// A category (matching the original's fixed set) plus free text. On success the
/// form clears and confirms; the button is disabled while empty and while
/// sending, so there is no dead tap and no double-submit.
class FeedbackScreen extends ConsumerStatefulWidget {
  const FeedbackScreen({super.key});
  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackState();
}

class _FeedbackState extends ConsumerState<FeedbackScreen> {
  final _ctrl = TextEditingController();
  String _type = 'bug';
  bool _sending = false;

  static const _types = {
    'bug': 'Bug',
    'suggest': 'Suggestion',
    'account': 'Account issue',
    'other': 'Other',
  };

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  Future<void> _submit() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(apiProvider).call('feedback.report', params: {'type': _type, 'content': text});
      if (!mounted) return;
      _ctrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thanks — your feedback was sent'), backgroundColor: ZC.card));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not send: $e'), backgroundColor: ZC.danger));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext c) {
    final canSend = _ctrl.text.trim().isNotEmpty && !_sending;
    return ZPage(
      title: 'Feedback',
      body: ListView(padding: const EdgeInsets.all(ZSpace.lg), children: [
        const SectionHeader('Category'),
        Wrap(spacing: ZSpace.sm, runSpacing: ZSpace.sm, children: [
          for (final e in _types.entries)
            GestureDetector(
              onTap: () => setState(() => _type = e.key),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: _type == e.key ? ZC.purple : ZC.card,
                  borderRadius: BorderRadius.circular(ZRadius.pill)),
                child: Text(e.value, style: TextStyle(color: _type == e.key ? Colors.white : ZC.textLo)),
              ),
            ),
        ]),
        const SizedBox(height: ZSpace.lg),
        const SectionHeader('Details'),
        Container(
          decoration: BoxDecoration(color: ZC.card, borderRadius: BorderRadius.circular(ZRadius.md)),
          padding: const EdgeInsets.all(ZSpace.md),
          child: TextField(
            controller: _ctrl,
            onChanged: (_) => setState(() {}),
            maxLines: 6, maxLength: 500,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              border: InputBorder.none, counterStyle: TextStyle(color: ZC.textLo),
              hintText: 'Describe the issue or idea…', hintStyle: TextStyle(color: ZC.textLo)),
          ),
        ),
        const SizedBox(height: ZSpace.lg),
        SizedBox(
          height: 48,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: canSend ? ZC.gold : ZC.card,
              foregroundColor: canSend ? Colors.black : ZC.textLo),
            onPressed: canSend ? _submit : null,
            child: _sending
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
              : const Text('Submit'),
          ),
        ),
      ]),
    );
  }
}
