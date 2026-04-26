using UnityEngine;
using ${project_pascal}.Core;

namespace ${project_pascal}.Bootstrap
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
