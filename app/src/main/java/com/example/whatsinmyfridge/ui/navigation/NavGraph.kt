package com.example.whatsinmyfridge.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.whatsinmyfridge.ui.home.HomeScreen
import com.example.whatsinmyfridge.ui.scan.ScanScreen

sealed class Route(val path: String) {
    data object Home : Route("home")
    data object Scan : Route("scan")
}

@Composable
fun AppNav(nav: NavHostController = rememberNavController()) {
    NavHost(
        navController = nav,
        startDestination = Route.Home.path
    ) {
        composable(Route.Home.path) { HomeScreen(nav) }
        composable(Route.Scan.path) { ScanScreen(nav) }
    }
}