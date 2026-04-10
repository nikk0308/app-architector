namespace ${project_pascal}.Services
{
    public class StateStore
    {
        public string CurrentFlowState { get; private set; } = "boot";

        public void SetState(string nextState)
        {
            CurrentFlowState = nextState;
        }
    }
}
