import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Initialize date formatting for all supported locales so DateFormat
  // can render weekday / month names in the correct language.
  await initializeDateFormatting('zh_TW');
  await initializeDateFormatting('en');
  await initializeDateFormatting('ja');
  runApp(const ProviderScope(child: NudgeApp()));
}
