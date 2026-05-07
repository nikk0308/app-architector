class CacheStore {
  final Map<String, Object?> _values = {};

  Object? read(String key) => _values[key];

  void write(String key, Object? value) {
    _values[key] = value;
  }
}
