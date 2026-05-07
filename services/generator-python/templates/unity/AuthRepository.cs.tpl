namespace ${projectPascal}.Modules.Auth
{
    public sealed class AuthRepository
    {
        public string Token { get; private set; } = string.Empty;

        public void StoreToken(string token)
        {
            Token = token;
        }
    }
}
