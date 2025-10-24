package com.example.whatsinmyfridge.ui.scan

import android.Manifest
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.navigation.NavController
import coil.compose.rememberAsyncImagePainter
import org.koin.androidx.compose.koinViewModel
import java.io.File

/**
 * Pantalla de escaneo de tickets con cámara.
 *
 * Permite capturar una foto del ticket y procesarla con OCR.
 *
 * @param nav Controlador de navegación
 * @param vm ViewModel inyectado por Koin
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanScreen(
    nav: NavController,
    vm: ScanVm = koinViewModel()
) {
    val context = LocalContext.current
    val isProcessing by vm.isProcessing.collectAsState()
    val capturedImageUri by vm.capturedImageUri.collectAsState()
    val ocrResult by vm.ocrResult.collectAsState()
    val errorMessage by vm.errorMessage.collectAsState()

    // Estado para permisos de cámara
    var hasCameraPermission by remember { mutableStateOf(false) }

    // Launcher para solicitar permiso de cámara
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    // Launcher para capturar foto
    val imageUri = remember {
        val file = File(context.cacheDir, "ticket_${System.currentTimeMillis()}.jpg")
        FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            vm.processImage(imageUri)
        }
    }

    // Solicitar permiso al iniciar
    LaunchedEffect(Unit) {
        permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Escanear Ticket") },
                navigationIcon = {
                    IconButton(onClick = {
                        vm.clearState()
                        nav.popBackStack()
                    }) {
                        Icon(Icons.Default.ArrowBack, "Volver")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Mostrar imagen capturada
            capturedImageUri?.let { uri ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                ) {
                    Image(
                        painter = rememberAsyncImagePainter(uri),
                        contentDescription = "Ticket capturado",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                }
            }

            // Mostrar resultado OCR
            ocrResult?.let { text ->
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Texto detectado:",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                        )
                        Text(
                            text = text,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                Button(
                    onClick = {
                        // TODO: Navegar a ReviewDraftScreen
                        // nav.navigate(Route.ReviewDraft.path)
                        vm.clearState()
                        nav.popBackStack()
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Revisar y Confirmar")
                }
            }

            // Botón de captura
            if (capturedImageUri == null) {
                Button(
                    onClick = {
                        if (hasCameraPermission) {
                            cameraLauncher.launch(imageUri)
                        } else {
                            permissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Capturar Ticket")
                }

                Text(
                    text = "Toma una foto clara del ticket de compra",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else if (isProcessing) {
                CircularProgressIndicator()
                Text("Procesando imagen...")
            }

            // Mostrar error si existe
            errorMessage?.let { error ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = error,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { vm.dismissError() }) {
                            Text("OK")
                        }
                    }
                }
            }
        }
    }
}