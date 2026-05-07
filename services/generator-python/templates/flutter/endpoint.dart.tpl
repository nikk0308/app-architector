enum Endpoint {
  health('/health'),
  auth('/auth');

  const Endpoint(this.path);
  final String path;
}
