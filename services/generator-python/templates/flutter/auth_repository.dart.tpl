class AuthRepository {
  String? _token;

  Future<void> saveToken(String token) async {
    _token = token;
  }

  String? get currentToken => _token;
}
