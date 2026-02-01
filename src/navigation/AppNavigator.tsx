import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { colors } from '../theme';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import RecipesProScreen from '../screens/RecipesProScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ReviewDraftScreen from '../screens/ReviewDraftScreen';
import DetailScreen from '../screens/DetailScreen';
import AddItemScreen from '../screens/AddItemScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? 'HomeTab' : 'Login'}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {!user ? (
          // Auth stack
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          // Main app stack (navegación con FABs)
          <>
            <Stack.Screen
              name="HomeTab"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ScanTab"
              component={ScanScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RecipesTab"
              component={RecipesProScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SettingsTab"
              component={SettingsScreen}
              options={{ title: 'Ajustes' }}
            />
            <Stack.Screen
              name="ReviewDraft"
              component={ReviewDraftScreen}
              options={{
                title: 'Revisar Items',
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="Detail"
              component={DetailScreen}
              options={{
                title: 'Detalle del Item',
                presentation: 'card'
              }}
            />
            <Stack.Screen
              name="AddItem"
              component={AddItemScreen}
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
