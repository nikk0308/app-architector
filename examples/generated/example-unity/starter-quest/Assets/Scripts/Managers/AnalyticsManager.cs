using UnityEngine;

namespace StarterQuest.Managers
{
    public class AnalyticsManager : MonoBehaviour
    {
        public void TrackScreen(string screenName)
        {
            Debug.Log($"[Analytics] Screen: {screenName}");
        }
    }
}
