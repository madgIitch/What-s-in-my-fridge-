@file:OptIn(ExperimentalMaterial3Api::class)

package com.example.whatsinmyfridge.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.SwipeToDismissBoxState
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.whatsinmyfridge.domain.model.ExpiryState
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import com.example.whatsinmyfridge.ui.navigation.Route
import org.koin.androidx.compose.koinViewModel


/**
 * Pantalla principal que muestra el inventario de alimentos.
 *
 * Características:
 * - Lista de items con estados de caducidad (OK/SOON/EXPIRED)
 * - FAB para escanear tickets y añadir manualmente
 * - Click en items para ver detalles
 * - Estado vacío cuando no hay items
 * - Accesibilidad mejorada con semantics
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
    var showDeleteAllDialog by remember { mutableStateOf(false) }  // ← AGREGAR ESTA LÍNEA

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Mi Nevera",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    // Botón para borrar todos los elementos
                    if (items.isNotEmpty()) {
                        IconButton(onClick = { showDeleteAllDialog = true }) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Borrar todos los elementos",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        floatingActionButton = {
            FloatingActionButtons(
                onScanClick = { nav.navigate(Route.Scan.path) },
                onAddClick = {
                    nav.navigate(Route.AddItem.path)
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (items.isEmpty()) {
                EmptyState()
            } else {
                FoodList(
                    items = items,
                    onItemClick = { item ->
                        nav.navigate(Route.Detail.createRoute(item.entity.id))
                    },
                    onItemDelete = { item ->  // ← NUEVO
                        vm.deleteItem(item)
                    }
                )
            }
        }

        // Diálogo de confirmación
        if (showDeleteAllDialog) {
            DeleteAllConfirmationDialog(
                onConfirm = {
                    vm.deleteAllItems()
                    showDeleteAllDialog = false
                },
                onDismiss = {
                    showDeleteAllDialog = false
                }
            )
        }
    }


}

/**
 * Botones de acción flotantes para escanear y añadir manualmente.
 */
@Composable
private fun FloatingActionButtons(
    onScanClick: () -> Unit,
    onAddClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // FAB secundario para añadir manualmente
        SmallFloatingActionButton(
            onClick = onAddClick,
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
            modifier = Modifier.semantics {
                contentDescription = "Añadir alimento manualmente"
            }
        ) {
            Icon(
                Icons.Default.Add,
                contentDescription = null
            )
        }

        // FAB principal para escanear
        ExtendedFloatingActionButton(
            onClick = onScanClick,
            icon = {
                Icon(
                    Icons.Default.Camera,
                    contentDescription = null
                )
            },
            text = { Text("Escanear") },
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier.semantics {
                contentDescription = "Escanear ticket de compra"
            }
        )
    }
}

/**
 * Lista de alimentos con scroll vertical.
 *
 * Usa LazyColumn para renderizado eficiente de listas grandes.
 * Cada item tiene una key única basada en su ID para optimizar recomposiciones.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FoodList(
    items: List<FoodItemUi>,
    onItemClick: (FoodItemUi) -> Unit,
    onItemDelete: (FoodItemUi) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp)
    ) {
        items(
            items = items,
            key = { it.entity.id }
        ) { item ->
            val dismissState = rememberSwipeToDismissBoxState(
                confirmValueChange = { dismissValue ->
                    if (dismissValue == SwipeToDismissBoxValue.EndToStart) {
                        onItemDelete(item)
                        true
                    } else {
                        false
                    }
                }
            )

            SwipeToDismissBox(
                state = dismissState,
                backgroundContent = {
                    SwipeBackground(dismissState = dismissState)
                }
            ) {
                FoodRow(
                    item = item,
                    onClick = { onItemClick(item) }
                )
            }

            HorizontalDivider(
                modifier = Modifier.padding(horizontal = 16.dp),
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeBackground(dismissState: androidx.compose.material3.SwipeToDismissBoxState) {
    val color = when (dismissState.targetValue) {
        SwipeToDismissBoxValue.EndToStart -> MaterialTheme.colorScheme.error
        else -> Color.Transparent
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color)
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.CenterEnd
    ) {
        if (dismissState.targetValue == SwipeToDismissBoxValue.EndToStart) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Eliminar",
                tint = MaterialTheme.colorScheme.onError,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}
/**
 * Fila individual que representa un item de comida.
 *
 * Muestra:
 * - Nombre del item
 * - Estado de caducidad (texto y color)
 * - Cantidad si es mayor a 1
 * - Días restantes en un badge
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
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = "${item.entity.name}, $stateText, ${item.daysLeft} días restantes"
            },
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Información del item
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = item.entity.name,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stateText,
                    style = MaterialTheme.typography.bodySmall,
                    color = color.copy(alpha = 0.9f),
                    fontWeight = FontWeight.Medium
                )

                // Mostrar cantidad si es mayor a 1
                if (item.entity.quantity > 1) {
                    Text(
                        text = "• ${item.entity.quantity} ${item.entity.unit}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Badge de días restantes
        ExpiryBadge(
            daysLeft = item.daysLeft,
            color = color
        )
    }
}

/**
 * Badge que muestra los días restantes hasta la caducidad.
 */
@Composable
private fun ExpiryBadge(
    daysLeft: Long,
    color: Color
) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = 0.15f),
        shadowElevation = 0.dp
    ) {
        Text(
            text = "${daysLeft}d",
            style = MaterialTheme.typography.labelLarge,
            color = color,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}

/**
 * Estado vacío cuando no hay items en el inventario.
 *
 * Muestra un mensaje amigable invitando al usuario a escanear su primer ticket.
 */
@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Icono grande con fondo
        Surface(
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.size(120.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Icon(
                    imageVector = Icons.Default.Camera,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Título
        Text(
            text = "No hay alimentos registrados",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Descripción
        Text(
            text = "Escanea un ticket para comenzar\na gestionar tu nevera",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            textAlign = TextAlign.Center
        )
    }


}

@Composable
fun DeleteAllConfirmationDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                Icons.Default.Delete,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(32.dp)
            )
        },
        title = {
            Text(
                text = "¿Borrar todos los elementos?",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(
                text = "Esta acción eliminará permanentemente todos los alimentos de tu inventario. No se puede deshacer.",
                style = MaterialTheme.typography.bodyMedium
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Borrar todo")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}