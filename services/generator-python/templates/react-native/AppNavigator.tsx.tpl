import React from 'react';
import { View, Text } from 'react-native';

export function AppNavigator() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>${display_name} / ${navigation_style}</Text>
    </View>
  );
}
