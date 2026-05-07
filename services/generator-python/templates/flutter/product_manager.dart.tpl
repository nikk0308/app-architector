class ${boundary_name} {
  const ${boundary_name}();

  static const kind = '${boundary_kind}';
  static const configPath = '${boundary_config_path}';
  static const dependencies = '${boundary_dependencies}';

  String prepare() => '${boundary_role}: $$configPath -> $$dependencies';
}
