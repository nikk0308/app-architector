using UnityEngine;

namespace StarterQuest.Managers
{
    public class AuthManager : MonoBehaviour
    {
        public bool IsAuthenticated { get; private set; }

        public void SignInAnonymously()
        {
            IsAuthenticated = true;
            Debug.Log("[Auth] Anonymous auth scaffold executed.");
        }
    }
}
