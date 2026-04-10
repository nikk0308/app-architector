using UnityEngine;
using StarterQuest.Core;

namespace StarterQuest.Bootstrap
{
    public class BootSceneController : MonoBehaviour
    {
        [SerializeField] private AppManager appManager;

        private void Start()
        {
            Debug.Log("Boot scene started.");
        }
    }
}
