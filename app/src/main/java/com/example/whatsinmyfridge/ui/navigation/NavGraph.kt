package com.example.whatsinmyfridge.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.whatsinmyfridge.ui.add.AddItemScreen
import com.example.whatsinmyfridge.ui.detail.DetailScreen
import com.example.whatsinmyfridge.ui.home.HomeScreen
import com.example.whatsinmyfridge.ui.scan.ScanScreen
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

sealed class Route(val path: String) {
    object Home : Route("home")
    object Scan : Route("scan")
    object Detail : Route("detail/{itemId}") {  // Nueva ruta
        fun createRoute(itemId: Long) = "detail/$itemId"
    }
    object AddItem : Route("add_item")
    object ReviewDraft : Route("review_draft/{draftId}") {
        fun createRoute(draftId: Long) = "review_draft/$draftId"
    }
}

@Composable
fun AppNav() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Route.Home.path) {
        composable(Route.Home.path) { HomeScreen(nav) }
        composable(Route.Scan.path) { ScanScreen(nav) }

        // Nueva ruta con argumento
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

        // Nuevo: Ruta para añadir items
        composable(Route.AddItem.path) {
            AddItemScreen(nav)
        }
    }
}