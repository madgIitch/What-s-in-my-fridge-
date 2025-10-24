@file:OptIn(ExperimentalMaterial3Api::class)

package com.example.whatsinmyfridge.ui.home

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.whatsinmyfridge.domain.model.ExpiryState
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import com.example.whatsinmyfridge.ui.navigation.Route
import org.koin.androidx.compose.koinViewModel

/**
 * Pantalla principal que muestra el inventario de alimentos.
 *
 * @param nav Controlador de navegación para transiciones entre pantallas
 * @param vm ViewModel inyectado por Koin que gestiona el estado de la UI
 */
@Composable
fun HomeScreen(
    nav: NavController,
    vm: HomeVm = koinViewModel()
) {
    val items by vm.items.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mi Nevera") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { nav.navigate(Route.Scan.path) },
                icon = {
                    Icon(
                        Icons.Default.Camera,
                        contentDescription = "Escanear ticket"
                    )
                },
                text = { Text("Escanear ticket") },
                containerColor = MaterialTheme.colorScheme.primary
            )
        }
    ) { paddingValues ->
        if (items.isEmpty()) {
            EmptyState(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            )
        } else {
            FoodList(
                items = items,
                onItemClick = { item ->
                    // TODO: Navegar a pantalla de detalle
                    // nav.navigate(Route.Detail.createPath(item.entity.id))
                },
                modifier = Modifier.padding(paddingValues)
            )
        }
    }
}

/**
 * Lista de alimentos con scroll vertical.
 */
@Composable
private fun FoodList(
    items: List<FoodItemUi>,
    onItemClick: (FoodItemUi) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(modifier = modifier) {
        items(
            items = items,
            key = { it.entity.id }
        ) { item ->
            FoodRow(
                item = item,
                onClick = { onItemClick(item) }
            )
            HorizontalDivider()
        }
    }
}

/**
 * Fila individual que representa un item de comida.
 *
 * @param item Datos del item a mostrar
 * @param onClick Callback cuando se hace click en la fila
 */
@Composable
private fun FoodRow(
    item: FoodItemUi,
    onClick: () -> Unit
) {
    val color = when (item.state) {
        ExpiryState.OK -> Color(0xFF4CAF50)       // Verde
        ExpiryState.SOON -> Color(0xFFFFC107)     // Amarillo
        ExpiryState.EXPIRED -> Color(0xFFF44336)  // Rojo
    }

    val stateText = when (item.state) {
        ExpiryState.OK -> "Fresco"
        ExpiryState.SOON -> "Próximo a caducar"
        ExpiryState.EXPIRED -> "Caducado"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(Color.Transparent)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = item.entity.name,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = stateText,
                style = MaterialTheme.typography.bodySmall,
                color = color.copy(alpha = 0.8f)
            )
        }

        Surface(
            shape = MaterialTheme.shapes.small,
            color = color.copy(alpha = 0.15f)
        ) {
            Text(
                text = "${item.daysLeft}d",
                style = MaterialTheme.typography.labelLarge,
                color = color,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }
    }
}

/**
 * Estado vacío cuando no hay items en el inventario.
 */
@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Camera,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No hay alimentos registrados",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Escanea un ticket para comenzar",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
    }
}