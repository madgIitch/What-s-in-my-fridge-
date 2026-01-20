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
import ReviewDraftScreen from '../screens/ReviewDraftScreen';
import DetailScreen from '../screens/DetailScreen';
import AddItemScreen from '../screens/AddItemScreen';
import RecipesProScreen from '../screens/RecipesProScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? 'Home' : 'Login'}
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
          // Main app stack
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Mi Inventario' }}
            />
            <Stack.Screen
              name="Scan"
              component={ScanScreen}
              options={{ title: 'Escanear Recibo' }}
            />
            <Stack.Screen
              name="ReviewDraft"
              component={ReviewDraftScreen}
              options={{ title: 'Revisar Items' }}
            />
            <Stack.Screen
              name="Detail"
              component={DetailScreen}
              options={{ title: 'Detalle del Item' }}
            />
            <Stack.Screen
              name="AddItem"
              component={AddItemScreen}
              options={{ title: 'Añadir Item' }}
            />
            <Stack.Screen
              name="RecipesPro"
              component={RecipesProScreen}
              options={{ title: 'Recetas Sugeridas' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Configuración' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
