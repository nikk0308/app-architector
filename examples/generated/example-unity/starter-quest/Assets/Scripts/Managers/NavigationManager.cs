using UnityEngine;

namespace StarterQuest.Managers
{
    public class NavigationManager : MonoBehaviour
    {
        public string CurrentScene => "Bootstrap";

        public void GoTo(string sceneName)
        {
            Debug.Log($"[Navigation] Switching from {CurrentScene} to {sceneName}");
        }
    }
}
