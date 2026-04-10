namespace StarterQuest.Services
{
    public class PersistenceService
    {
        public void SaveString(string key, string value)
        {
            UnityEngine.PlayerPrefs.SetString(key, value);
        }
    }
}
