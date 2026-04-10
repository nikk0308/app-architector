using UnityEngine;

namespace ${project_pascal}.Managers
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
