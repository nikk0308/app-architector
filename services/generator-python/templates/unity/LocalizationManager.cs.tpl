using System.Collections.Generic;
using UnityEngine;

namespace ${project_pascal}.Managers
{
    public class LocalizationManager : MonoBehaviour
    {
        public string CurrentLocale => "uk";

        private static readonly Dictionary<string, string> En = new()
        {
            ["app.title"] = "${app_display_name}",
            ["home.title"] = "${app_display_name}",
            ["home.subtitle"] = "Generated architecture scaffold",
            ["home.generatedScreen"] = "Generated home screen",
            ["common.loading"] = "Loading…",
            ["common.ready"] = "Ready",
            ["common.error"] = "Something went wrong"
        };

        private static readonly Dictionary<string, string> Uk = new()
        {
            ["app.title"] = "${app_display_name}",
            ["home.title"] = "${app_display_name}",
            ["home.subtitle"] = "Згенерований архітектурний scaffold",
            ["home.generatedScreen"] = "Згенерований стартовий екран",
            ["common.loading"] = "Завантаження…",
            ["common.ready"] = "Готово",
            ["common.error"] = "Щось пішло не так"
        };

        public string Translate(string key)
        {
            var dictionary = CurrentLocale == "uk" ? Uk : En;
            return dictionary.TryGetValue(key, out var value) ? value : key;
        }
    }
}
