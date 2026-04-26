using UnityEngine;

namespace ${project_pascal}.Managers
{
    public class LocalizationManager : MonoBehaviour
    {
        public string CurrentLocale => "uk";

        public string Translate(string key)
        {
            return $"[{CurrentLocale}] {key}";
        }
    }
}
