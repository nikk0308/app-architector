class LocalizationService {
  String currentLocale = 'uk';

  String translate(String key) => '$currentLocale:$key';
}
