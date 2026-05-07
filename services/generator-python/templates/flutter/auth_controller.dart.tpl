import 'auth_repository.dart';

class AuthController {
  AuthController(this.repository);

  final AuthRepository repository;

  Future<void> signIn(String email, String password) async {
    await repository.saveToken('replace-with-real-token');
  }
}
