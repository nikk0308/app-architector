export const ${boundary_name} = {
  kind: "${boundary_kind}",
  role: "${boundary_role}",
  configPath: "${boundary_config_path}",
  dependencies: "${boundary_dependencies}",
} as const;

export function prepare${boundary_pascal}(): string {
  return ${boundary_name}.role + ": " + ${boundary_name}.configPath + " -> " + ${boundary_name}.dependencies;
}
