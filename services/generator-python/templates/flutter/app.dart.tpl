import 'package:flutter/material.dart';
import '../features/home/home_screen.dart';

class GeneratedApp extends StatelessWidget {
  const GeneratedApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${display_name}',
      home: const HomeScreen(),
    );
  }
}
