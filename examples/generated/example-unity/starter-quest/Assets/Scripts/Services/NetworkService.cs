using UnityEngine;

namespace StarterQuest.Services
{
    public class NetworkService
    {
        public string BaseUrl => "https://api.example.com";

        public void Get(string endpoint)
        {
            Debug.Log($"[Network] GET {BaseUrl}/{endpoint}");
        }
    }
}
