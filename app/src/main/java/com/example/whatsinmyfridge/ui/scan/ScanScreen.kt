package com.example.whatsinmyfridge.ui.scan

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavController

@Composable
fun ScanScreen(nav: NavController) {
    Scaffold { pad ->
        Column(Modifier.padding(pad).fillMaxSize(), verticalArrangement = Arrangement.Center) {
            Text("Pantalla de escaneo (CameraX pronto)")
            Button(onClick = { nav.popBackStack() }) { Text("Volver") }
        }
    }
}
