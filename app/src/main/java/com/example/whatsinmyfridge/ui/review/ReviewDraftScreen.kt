package com.example.whatsinmyfridge.ui.review

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

/**
 * Pantalla para revisar y editar borradores de escaneo OCR.
 *
 * Permite al usuario:
 * - Ver información del ticket escaneado
 * - Revisar items parseados del OCR
 * - Editar nombres y cantidades de items
 * - Eliminar items no deseados
 * - Confirmar y añadir items al inventario
 * - Descartar el borrador completo
 *
 * @param draftId ID del borrador a revisar
 * @param nav Controlador de navegación
 * @param vm ViewModel inyectado por Koin con el draftId como parámetro
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewDraftScreen(
    draftId: Long,
    nav: NavController,
    vm: ReviewDraftVm = koinViewModel { parametersOf(draftId) }
) {
    val draft by vm.draft.collectAsState()
    val parsedItems by vm.parsedItems.collectAsState()
    val isLoading by vm.isLoading.collectAsState()
    val isSaving by vm.isSaving.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Revisar Escaneo") },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    // Botón para descartar borrador
                    IconButton(
                        onClick = {
                            vm.discardDraft()
                            nav.popBackStack()
                        },
                        enabled = !isSaving
                    ) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Descartar",
                            tint = if (isSaving) {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            } else {
                                MaterialTheme.colorScheme.error
                            }
                        )
                    }

                    // Botón para confirmar y guardar
                    IconButton(
                        onClick = {
                            vm.confirmDraft()
                            nav.popBackStack()
                        },
                        enabled = !isSaving && parsedItems.isNotEmpty()
                    ) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = "Confirmar",
                            tint = if (!isSaving && parsedItems.isNotEmpty()) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            }
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator()
                    Text(
                        text = "Cargando borrador...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                // Información del ticket
                draft?.let { draftInfo ->
                    DraftInfoCard(draftInfo)
                }

                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 8.dp),
                    thickness = 1.dp,
                    color = MaterialTheme.colorScheme.outlineVariant
                )

                // Lista de items parseados
                if (parsedItems.isEmpty()) {
                    EmptyItemsState()
                } else {
                    // Contador de items
                    Text(
                        text = "${parsedItems.size} ${if (parsedItems.size == 1) "item encontrado" else "items encontrados"}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        color = MaterialTheme.colorScheme.primary
                    )

                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        itemsIndexed(
                            items = parsedItems,
                            key = { index, _ -> index }
                        ) { index, item ->
                            ParsedItemCard(
                                item = item,
                                onEdit = { updatedItem ->
                                    vm.updateParsedItem(index, updatedItem)
                                },
                                onDelete = {
                                    vm.removeParsedItem(index)
                                }
                            )
                        }
                    }
                }

                // Botón de confirmación inferior
                if (parsedItems.isNotEmpty()) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shadowElevation = 8.dp,
                        tonalElevation = 2.dp
                    ) {
                        Button(
                            onClick = {
                                vm.confirmDraft()
                                nav.popBackStack()
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            enabled = !isSaving
                        ) {
                            if (isSaving) {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(20.dp),
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        strokeWidth = 2.dp
                                    )
                                    Text("Guardando...")
                                }
                            } else {
                                Text("Confirmar y Añadir ${parsedItems.size} ${if (parsedItems.size == 1) "Item" else "Items"}")
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Card que muestra la información del ticket escaneado.
 *
 * @param draft Entidad del borrador con información del ticket
 */
@Composable
private fun DraftInfoCard(draft: ParsedDraftEntity) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Información del Ticket",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )

            draft.merchant?.let {
                InfoRow(label = "Comercio", value = it)
            }

            draft.purchaseDate?.let {
                InfoRow(label = "Fecha", value = it)
            }

            draft.total?.let {
                InfoRow(
                    label = "Total",
                    value = "${draft.currency} ${String.format("%.2f", it)}"
                )
            }

            // Mostrar timestamp de escaneo
            InfoRow(
                label = "Escaneado",
                value = java.text.SimpleDateFormat(
                    "dd/MM/yyyy HH:mm",
                    java.util.Locale.getDefault()
                ).format(java.util.Date(draft.timestamp))
            )
        }
    }
}

/**
 * Fila de información con label y valor.
 */
@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = "$label:",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSecondaryContainer
        )
    }
}

/**
 * Card para mostrar y editar un item parseado del OCR.
 *
 * @param item Item parseado a mostrar
 * @param onEdit Callback cuando se edita el item
 * @param onDelete Callback cuando se elimina el item
 */
@Composable
private fun ParsedItemCard(
    item: ParsedItem,
    onEdit: (ParsedItem) -> Unit,
    onDelete: () -> Unit
) {
    var isEditing by remember { mutableStateOf(false) }
    var editedName by remember(item.name) { mutableStateOf(item.name) }
    var editedQuantity by remember(item.quantity) { mutableStateOf(item.quantity.toString()) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header con nombre y botones
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isEditing) {
                    OutlinedTextField(
                        value = editedName,
                        onValueChange = { editedName = it },
                        label = { Text("Nombre") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                } else {
                    Text(
                        text = item.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    if (!isEditing) {
                        IconButton(onClick = { isEditing = true }) {
                            Icon(
                                Icons.Default.Edit,
                                contentDescription = "Editar",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }

                    IconButton(onClick = onDelete) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Eliminar",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // Detalles del item
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isEditing) {
                    OutlinedTextField(
                        value = editedQuantity,
                        onValueChange = { editedQuantity = it },
                        label = { Text("Cantidad") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                } else {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Cantidad:",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "${item.quantity}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                item.price?.let { price ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Precio:",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "€${String.format("%.2f", price)}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // Fecha de caducidad si existe
            item.expiryDate?.let { expiryDate ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Caduca:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = expiryDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            // Botones de acción
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isEditing) {
                    TextButton(onClick = { isEditing = false }) {
                        Text("Cancelar")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(
                        onClick = {
                            onEdit(
                                item.copy(
                                    name = editedName,
                                    quantity = editedQuantity.toIntOrNull() ?: item.quantity
                                )
                            )
                            isEditing = false
                        }
                    ) {
                        Text("Guardar")
                    }
                } else {
                    IconButton(onClick = onDelete) {  // ✅ Sin parámetros
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Eliminar",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(onClick = { isEditing = true }) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = "Editar"
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyItemsState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "No se encontraron items",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "El escaneo no detectó productos",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}