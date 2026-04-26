class NetworkClient {
  final String baseUrl = 'https://api.example.com';

  Future<String> get(String path) async {
    return 'GET $path via $baseUrl';
  }
}
