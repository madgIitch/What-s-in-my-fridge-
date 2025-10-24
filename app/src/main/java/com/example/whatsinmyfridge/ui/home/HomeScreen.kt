package com.example.whatsinmyfridge.ui.home

import androidx.camera.core.Camera
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.whatsinmyfridge.domain.model.ExpiryState
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import com.example.whatsinmyfridge.ui.navigation.Route

@Composable
fun HomeScreen(nav: NavController, vm: HomeVm = hiltViewModel()) {
    val items by vm.items.collectAsState()

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { nav.navigate(Route.Scan.path) },
                icon = { Icon(Icons.Default.Camera, contentDescription = null) },
                text = { Text("Escanear ticket") }
            )
        }
    ) { pad ->
        LazyColumn(Modifier.padding(pad)) {
            items(items) { item ->
                FoodRow(item)
                Divider()
            }
        }
    }
}

@Composable
fun FoodRow(item: FoodItemUi) {
    val color = when (item.state) {
        ExpiryState.OK -> Color(0xFF4CAF50)
        ExpiryState.SOON -> Color(0xFFFFC107)
        ExpiryState.EXPIRED -> Color(0xFFF44336)
    }
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color.Transparent)
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(item.entity.name)
        Text("${item.daysLeft}d", color = color)
    }
}
