using UnityEngine;

namespace ${project_pascal}.Managers
{
    public class AnalyticsManager : MonoBehaviour
    {
        public void TrackScreen(string screenName)
        {
            Debug.Log($"[Analytics] Screen: {screenName}");
        }
    }
}
