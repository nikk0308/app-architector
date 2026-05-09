type Locale = 'en' | 'uk';
type TranslationKey =
  | 'app.title'
  | 'home.title'
  | 'home.subtitle'
  | 'home.generatedScreen'
  | 'launch.title'
  | 'common.loading'
  | 'common.ready'
  | 'common.error';

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    'app.title': '${app_display_name}',
    'home.title': '${app_display_name}',
    'home.subtitle': 'Generated architecture scaffold',
    'home.generatedScreen': 'Generated home screen',
    'launch.title': 'Launching ${app_display_name}…',
    'common.loading': 'Loading…',
    'common.ready': 'Ready',
    'common.error': 'Something went wrong'
  },
  uk: {
    'app.title': '${app_display_name}',
    'home.title': '${app_display_name}',
    'home.subtitle': 'Згенерований архітектурний scaffold',
    'home.generatedScreen': 'Згенерований стартовий екран',
    'launch.title': 'Запуск ${app_display_name}…',
    'common.loading': 'Завантаження…',
    'common.ready': 'Готово',
    'common.error': 'Щось пішло не так'
  }
};

export function t(key: TranslationKey, locale: Locale = 'en'): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}
