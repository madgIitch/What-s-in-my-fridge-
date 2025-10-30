package com.example.whatsinmyfridge.ui.recipespro

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import org.koin.androidx.compose.koinViewModel
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.ArrowForward
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import com.example.whatsinmyfridge.domain.model.RecipeUi

/**
 * Pantalla de IA Pro - Recetas.
 *
 * Permite al usuario:
 * - Configurar preferencias de cocina (tiempo, utensilios)
 * - Ver límites mensuales de llamadas
 * - Obtener sugerencias de recetas basadas en su inventario
 * - Ver recetas sugeridas con porcentaje de match
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipesProScreen(
    nav: NavController,
    vm: RecipesProVm = koinViewModel()
) {
    // ========== Estado ==========
    val cookingTime by vm.cookingTime.collectAsState()
    val availableUtensils by vm.availableUtensils.collectAsState()
    val monthlyCallsUsed by vm.monthlyRecipeCallsUsed.collectAsState()
    val isPro by vm.isPro.collectAsState()
    val recipes by vm.recipes.collectAsState()  // ✅ CORRECTO
    val isLoading by vm.isLoading.collectAsState()
    val errorMessage by vm.errorMessage.collectAsState()

    // Límite según plan
    val maxCalls = if (isPro) 100 else 10

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("IA Pro - Recetas") },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, "Volver")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { vm.getRecipeSuggestions() },
                        enabled = !isLoading
                    ) {
                        Icon(Icons.Default.Refresh, "Obtener recetas")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            // ========== Sección de Preferencias ==========
            PreferencesSection(
                cookingTime = cookingTime,
                availableUtensils = availableUtensils,
                onCookingTimeChange = { vm.setCookingTime(it) },
                onUtensilsChange = { vm.setAvailableUtensils(it) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ========== Límites Mensuales ==========
            UsageLimitSection(
                isPro = isPro,
                monthlyCallsUsed = monthlyCallsUsed
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ========== Mensaje de Error ==========
            errorMessage?.let { error ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = error,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { vm.clearError() }) {
                            Text("OK")
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // ========== Estado de Carga ==========
            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Obteniendo recetas...")
                    }
                }
            } else if (recipes.isEmpty()) {
                // ========== Estado Vacío ==========
                EmptyRecipesState()
            } else {
                // ========== Lista de Recetas ==========
                RecipesList(recipes = recipes)
            }
        }
    }
}

// ========== Componentes Auxiliares ==========

@Composable
private fun PreferencesSection(
    cookingTime: Int,
    availableUtensils: Set<String>,
    onCookingTimeChange: (Int) -> Unit,
    onUtensilsChange: (Set<String>) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Preferencias de Cocina",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Tiempo de cocina
            Text("Tiempo disponible: $cookingTime minutos")
            Slider(
                value = cookingTime.toFloat(),
                onValueChange = { onCookingTimeChange(it.toInt()) },
                valueRange = 10f..120f,
                steps = 21 // Pasos de 5 minutos
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Utensilios disponibles
            Text(
                text = "Utensilios disponibles",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Lista de utensilios comunes
            val commonUtensils = listOf(
                "horno", "microondas", "batidora", "olla a presión",
                "freidora", "licuadora", "procesador", "tostadora"
            )

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                commonUtensils.forEach { utensil ->
                    FilterChip(
                        selected = availableUtensils.contains(utensil),
                        onClick = {
                            val newUtensils = if (availableUtensils.contains(utensil)) {
                                availableUtensils - utensil
                            } else {
                                availableUtensils + utensil
                            }
                            onUtensilsChange(newUtensils)
                        },
                        label = { Text(utensil.replaceFirstChar { it.uppercase() }) }
                    )
                }
            }
        }
    }
}

@Composable
private fun UsageLimitSection(
    isPro: Boolean,
    monthlyCallsUsed: Int
) {
    val maxCalls = if (isPro) 100 else 10
    val progress = monthlyCallsUsed.toFloat() / maxCalls

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (progress >= 0.9f) {
                MaterialTheme.colorScheme.errorContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Llamadas este mes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                if (!isPro) {
                    AssistChip(
                        onClick = { /* TODO: Navegar a pantalla de compra */ },
                        label = { Text("Upgrade a Pro") },
                        leadingIcon = {
                            Icon(
                                Icons.Default.Star,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Barra de progreso
            LinearProgressIndicator(
                progress = progress,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = if (progress >= 0.9f) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.primary
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "$monthlyCallsUsed / $maxCalls llamadas usadas",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (progress >= 0.9f && !isPro) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "⚠️ Casi alcanzas tu límite mensual. Considera actualizar a Pro para 100 llamadas/mes.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun EmptyRecipesState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.Restaurant,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = "No hay recetas disponibles",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = "Ajusta tus preferencias y obtén sugerencias",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun RecipesList(recipes: List<RecipeUi>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(recipes, key = { it.id }) { recipe ->
            RecipeCard(recipe = recipe)
        }
    }
}

@Composable
private fun RecipeCard(recipe: RecipeUi) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Encabezado con nombre y porcentaje de match
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = recipe.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = when {
                        recipe.matchPercentage >= 80 -> Color(0xFF4CAF50).copy(alpha = 0.15f)
                        recipe.matchPercentage >= 60 -> Color(0xFFFFC107).copy(alpha = 0.15f)
                        else -> Color(0xFFFF9800).copy(alpha = 0.15f)
                    }
                ) {
                    Text(
                        text = "${recipe.matchPercentage}%",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = when {
                            recipe.matchPercentage >= 80 -> Color(0xFF4CAF50)
                            recipe.matchPercentage >= 60 -> Color(0xFFFFC107)
                            else -> Color(0xFFFF9800)
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Ingredientes que tienes
            if (recipe.matchedIngredients.isNotEmpty()) {
                Text(
                    text = "✓ Tienes: ${recipe.matchedIngredients.joinToString(", ")}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF4CAF50)
                )
            }

            // Ingredientes que faltan
            if (recipe.missingIngredients.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "✗ Faltan: ${recipe.missingIngredients.joinToString(", ")}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Botón para ver detalles
            TextButton(
                onClick = { /* TODO: Navegar a pantalla de detalle de receta */ },
                modifier = Modifier.align(Alignment.End)
            ) {
                Text("Ver receta completa")
                Icon(
                    Icons.Default.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

