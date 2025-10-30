package com.example.whatsinmyfridge.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.whatsinmyfridge.ui.add.AddItemScreen
import com.example.whatsinmyfridge.ui.detail.DetailScreen
import com.example.whatsinmyfridge.ui.home.HomeScreen
import com.example.whatsinmyfridge.ui.login.LoginScreen
import com.example.whatsinmyfridge.ui.recipespro.RecipesProScreen
import com.example.whatsinmyfridge.ui.scan.ScanScreen
import com.example.whatsinmyfridge.ui.review.ReviewDraftScreen
import com.example.whatsinmyfridge.ui.settings.SettingsScreen
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

/**
 * Rutas de navegación de la aplicación.
 *
 * Define todas las pantallas disponibles y sus paths.
 */
sealed class Route(val path: String) {
    object Login : Route("login")
    object Home : Route("home")
    object Scan : Route("scan")
    object Settings : Route("settings")  // ✅ NUEVO
    object Detail : Route("detail/{itemId}") {
        fun createRoute(itemId: Long) = "detail/$itemId"
    }
    object AddItem : Route("add_item")
    object ReviewDraft : Route("review_draft/{draftId}") {
        fun createRoute(draftId: Long) = "review_draft/$draftId"
    }
    object RecipesPro : Route("recipes_pro")
}

/**
 * Configuración de navegación principal de la app.
 *
 * Verifica autenticación al inicio y determina la pantalla inicial:
 * - Si el usuario está autenticado → HomeScreen
 * - Si no está autenticado → LoginScreen
 */
@Composable
fun AppNav() {
    val nav = rememberNavController()

    // Verificar autenticación para determinar pantalla inicial
    val auth = Firebase.auth
    val startDestination = if (auth.currentUser != null) {
        Route.Home.path
    } else {
        Route.Login.path
    }

    NavHost(navController = nav, startDestination = startDestination) {

        // ========== Pantalla de Login ==========
        composable(Route.Login.path) {
            LoginScreen(
                onLoginSuccess = {
                    nav.navigate(Route.Home.path) {
                        popUpTo(Route.Login.path) { inclusive = true }
                    }
                }
            )
        }

        // ========== Pantalla Principal ==========
        composable(Route.Home.path) {
            HomeScreen(nav)
        }

        // ========== Pantalla de Escaneo ==========
        composable(Route.Scan.path) {
            ScanScreen(nav)
        }

        // ========== Pantalla de Configuración ==========
        composable(Route.Settings.path) {
            SettingsScreen(nav = nav)  // ✅ NUEVO: Pasar NavController
        }

        // ========== Pantalla de Detalle de Item ==========
        composable(
            route = Route.Detail.path,
            arguments = listOf(navArgument("itemId") { type = NavType.LongType })
        ) { backStackEntry ->
            val itemId = backStackEntry.arguments?.getLong("itemId") ?: 0L
            DetailScreen(
                itemId = itemId,
                nav = nav,
                vm = koinViewModel { parametersOf(itemId) }
            )
        }

        // ========== Pantalla de Añadir Item Manual ==========
        composable(Route.AddItem.path) {
            AddItemScreen(nav)
        }

        // ========== Pantalla de Revisión de Draft OCR ==========
        composable(
            route = Route.ReviewDraft.path,
            arguments = listOf(navArgument("draftId") { type = NavType.LongType })
        ) { backStackEntry ->
            val draftId = backStackEntry.arguments?.getLong("draftId") ?: 0L
            ReviewDraftScreen(
                draftId = draftId,
                nav = nav,
                vm = koinViewModel { parametersOf(draftId) }
            )
        }

        composable(Route.RecipesPro.path) {
            RecipesProScreen(nav = nav)
        }
    }
}