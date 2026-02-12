import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { useMealStore } from '../stores/useMealStore';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import CropScreen from '../screens/CropScreen';
import RecipesProScreen from '../screens/RecipesProScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecipeStepsScreen from '../screens/RecipeStepsScreen';
import ReviewDraftScreen from '../screens/ReviewDraftScreen';
import DetailScreen from '../screens/DetailScreen';
import AddItemScreen from '../screens/AddItemScreen';
import ConsumeIngredientsScreen from '../screens/ConsumeIngredientsScreen';
import ConsumeRecipeIngredientsScreen from '../screens/ConsumeRecipeIngredientsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import AddMealScreen from '../screens/AddMealScreen';
import MealDetailScreen from '../screens/MealDetailScreen';
import AddRecipeFromUrlScreen from '../screens/AddRecipeFromUrlScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const user = useAuthStore((state) => state.user);
  const { startSync, stopSync } = useMealStore();

  useEffect(() => {
    if (user?.uid) {
      startSync(user.uid);
      return () => stopSync();
    }
    stopSync();
    return undefined;
  }, [user?.uid, startSync, stopSync]);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? 'HomeTab' : 'Login'}
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
              name="CalendarTab"
              component={CalendarScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SettingsTab"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="FavoritesTab"
              component={FavoritesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RecipeSteps"
              component={RecipeStepsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ReviewDraft"
              component={ReviewDraftScreen}
              options={{
                headerShown: false,
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
            <Stack.Screen
              name="Crop"
              component={CropScreen}
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                gestureEnabled: false
              }}
            />
            <Stack.Screen
              name="ConsumeIngredients"
              component={ConsumeIngredientsScreen}
              options={{
                headerShown: false,
                presentation: 'card'
              }}
            />
            <Stack.Screen
              name="ConsumeRecipeIngredients"
              component={ConsumeRecipeIngredientsScreen}
              options={{
                headerShown: false,
                presentation: 'card'
              }}
            />
            <Stack.Screen
              name="AddMeal"
              component={AddMealScreen}
              options={{
                headerShown: false,
                presentation: 'modal'
              }}
            />
            <Stack.Screen
              name="MealDetail"
              component={MealDetailScreen}
              options={{
                title: 'Detalle de comida',
                presentation: 'card'
              }}
            />
            <Stack.Screen
              name="AddRecipeFromUrl"
              component={AddRecipeFromUrlScreen}
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
