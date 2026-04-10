using UnityEngine;

namespace ${project_pascal}.Gameplay
{
    public class GameFlowController : MonoBehaviour
    {
        private string _state = "launch";

        public void Advance()
        {
            _state = "main-menu";
            Debug.Log($"[GameFlow] Current state: {_state}");
        }
    }
}
