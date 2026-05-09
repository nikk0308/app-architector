import React from 'react';
import { View, Text } from 'react-native';
import { t } from '../services/localization';

export function HomeScreen() {
  return (
    <View>
      <Text>{t('home.title')}</Text>
      <Text>{t('home.subtitle')}</Text>
      <Text>{t('home.generatedScreen')}</Text>
    </View>
  );
}
