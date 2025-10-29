package com.example.whatsinmyfridge.data.repository

import com.example.whatsinmyfridge.data.local.FoodDao
import com.example.whatsinmyfridge.data.local.db.FoodItemEntity
import com.example.whatsinmyfridge.domain.model.ExpiryState
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.time.LocalDate
import java.time.temporal.ChronoUnit

class InventoryRepository(
    private val dao: FoodDao,
    private val prefsRepository: PrefsRepository  // ✅ NUEVO: Inyectar PrefsRepository
) {

    // ========== Firebase ==========
    private val firestore = Firebase.firestore
    private val auth = Firebase.auth

    // ✅ NUEVO: CoroutineScope propio del repositorio
    private val repositoryScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var firestoreListener: ListenerRegistration? = null

    // ========== Métodos de Lectura ==========

    fun observeUi(): Flow<List<FoodItemUi>> =
        dao.getAllFlow().map { list ->
            list.map { entity ->
                val days = ChronoUnit.DAYS.between(LocalDate.now(), entity.expiryDate)
                val state = when {
                    days < 0 -> ExpiryState.EXPIRED
                    days <= 3 -> ExpiryState.SOON
                    else -> ExpiryState.OK
                }
                FoodItemUi(entity, state, days)
            }
        }

    suspend fun getItemById(id: Long): FoodItemEntity? = dao.getById(id)

    // ========== Métodos de Escritura con Sync ==========

    suspend fun addItem(item: FoodItemEntity): Long {
        val id = dao.insert(item)

        // ✅ Sincronizar a Firestore si cloudConsent está activado
        if (prefsRepository.cloudConsent.first()) {
            syncToFirestore(item.copy(id = id))
        }

        return id
    }

    suspend fun updateItem(item: FoodItemEntity) {
        dao.update(item)

        // ✅ Sincronizar a Firestore si cloudConsent está activado
        if (prefsRepository.cloudConsent.first()) {
            syncToFirestore(item)
        }
    }

    suspend fun deleteItem(id: Long) {
        dao.deleteById(id)

        // ✅ Eliminar de Firestore si cloudConsent está activado
        if (prefsRepository.cloudConsent.first()) {
            deleteFromFirestore(id)
        }
    }

    suspend fun deleteAllItems() {
        dao.deleteAll()

        // ✅ Eliminar todos de Firestore si cloudConsent está activado
        if (prefsRepository.cloudConsent.first()) {
            deleteAllFromFirestore()
        }
    }

    // ========== Sincronización Firestore ==========

    /**
     * Sube un item a Firestore
     */
    private suspend fun syncToFirestore(item: FoodItemEntity) {
        val userId = auth.currentUser?.uid ?: return

        firestore.collection("users")
            .document(userId)
            .collection("inventory")
            .document(item.id.toString())
            .set(mapOf(
                "name" to item.name,
                "expiryDate" to item.expiryDate.toEpochDay(),
                "category" to item.category,
                "quantity" to item.quantity,
                "notes" to item.notes,
                "source" to (item.source ?: "local"),
                "timestamp" to System.currentTimeMillis()
            ))
            .await()
    }

    /**
     * Elimina un item de Firestore
     */
    private suspend fun deleteFromFirestore(id: Long) {
        val userId = auth.currentUser?.uid ?: return

        firestore.collection("users")
            .document(userId)
            .collection("inventory")
            .document(id.toString())
            .delete()
            .await()
    }

    /**
     * Elimina todos los items de Firestore
     */
    private suspend fun deleteAllFromFirestore() {
        val userId = auth.currentUser?.uid ?: return

        val snapshot = firestore.collection("users")
            .document(userId)
            .collection("inventory")
            .get()
            .await()

        snapshot.documents.forEach { doc ->
            doc.reference.delete().await()
        }
    }

    // ========== Listener Bidireccional ==========

    /**
     * Inicia el listener de Firestore para sincronización en tiempo real
     * Debe llamarse desde HomeVm.init()
     */
    fun startFirestoreSync() {
        val userId = auth.currentUser?.uid ?: return

        firestoreListener = firestore.collection("users")
            .document(userId)
            .collection("inventory")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    println("Error en listener Firestore: ${error.message}")
                    return@addSnapshotListener
                }

                snapshot?.documentChanges?.forEach { change ->
                    repositoryScope.launch {
                        try {
                            when (change.type) {
                                DocumentChange.Type.ADDED,
                                DocumentChange.Type.MODIFIED -> {
                                    val data = change.document.data

                                    // ✅ Extraer y validar TODOS los campos requeridos
                                    val name = data["name"] as? String ?: run {
                                        println("Item sin nombre, ignorando: ${change.document.id}")
                                        return@launch
                                    }

                                    val expiryEpochDay = (data["expiryDate"] as? Number)?.toLong()
                                        ?: LocalDate.now().plusDays(7).toEpochDay()

                                    val quantity = (data["quantity"] as? Number)?.toInt() ?: 1

                                    // ✅ Ahora todos los valores son no-nullable
                                    val item = FoodItemEntity(
                                        id = change.document.id.toLong(),
                                        name = name,
                                        expiryDate = LocalDate.ofEpochDay(expiryEpochDay),
                                        category = data["category"] as? String,
                                        quantity = quantity,
                                        notes = data["notes"] as? String,
                                        source = data["source"] as? String ?: "manual"
                                    )
                                    dao.insert(item)
                                }
                                DocumentChange.Type.REMOVED -> {
                                    dao.deleteById(change.document.id.toLong())
                                }
                            }
                        } catch (e: Exception) {
                            println("Error procesando cambio de Firestore: ${e.message}")
                        }
                    }
                }
            }
    }    /**
     * Detiene el listener de Firestore
     * Debe llamarse desde HomeVm.onCleared()
     */
    fun stopFirestoreSync() {
        firestoreListener?.remove()
        repositoryScope.cancel()
    }
}