class ${mode_boundary_pascal} {
  const ${mode_boundary_pascal}();

  final String mode = '${generation_mode}';
  final String strategy = '${mode_strategy_summary}';
  final String relationship = '${mode_relationship_summary}';

  String explain() => '$$mode: $$strategy';
}
