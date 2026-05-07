sealed class ApiError {
  const ApiError(this.message);

  final String message;
}

final class NetworkUnavailable extends ApiError {
  const NetworkUnavailable() : super('Network unavailable');
}
