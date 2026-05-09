import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final language = Localizations.localeOf(context).languageCode;
    final title = language == 'uk' ? '${display_name}' : '${display_name}';
    final subtitle = language == 'uk'
        ? 'Згенерований архітектурний scaffold'
        : 'Generated architecture scaffold';
    final generatedScreen = language == 'uk'
        ? 'Згенерований стартовий екран'
        : 'Generated home screen';

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(subtitle),
            const SizedBox(height: 12),
            Text(generatedScreen),
          ],
        ),
      ),
    );
  }
}
