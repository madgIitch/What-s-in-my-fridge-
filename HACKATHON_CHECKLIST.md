# RevenueCat Shipyard: Creator Contest - Checklist de Submission

**Hackathon:** RevenueCat Shipyard 2026
**Deadline:** 12 Febrero 2026, 11:45 PM Eastern Time
**Web:** revenuecat-shipyard-2026.devpost.com

---

## Estado Actual del Proyecto

### Lo que YA tenemos

| # | Elemento | Estado |
|---|----------|--------|
| 1 | MVP funcional (18 pantallas) | OK |
| 2 | Backend completo (Cloud Functions + Cloud Run) | OK |
| 3 | Feature "URL a Receta" (YouTube, Instagram, TikTok, blogs) | OK |
| 4 | Firebase Auth (email + Google) | OK |
| 5 | Firestore + WatermelonDB (sync inventario) | OK |
| 6 | OCR de tickets de supermercado | OK |
| 7 | IA matching de recetas por ingredientes | OK |
| 8 | Normalización de ingredientes (330 ingredientes, multiidioma) | OK |
| 9 | Calendario de comidas | OK |
| 10 | Sistema de favoritos (solo local) | OK |
| 11 | Whisper Service en Cloud Run (transcripción de audio) | OK |
| 12 | Ollama qwen2.5:3b en Cloud Run (extracción con IA) | OK |

---

## Lo que FALTA para el Hackathon

### 1. RevenueCat SDK - BLOQUEANTE

**Requisito del hackathon:**
> "uses the RevenueCat SDK to power at least one in-app purchase or web purchase"

**Estado:** NO integrado. No hay ninguna referencia a RevenueCat en el codebase.

**Qué hacer:**
- [ ] Crear cuenta en RevenueCat dashboard (https://app.revenuecat.com)
- [ ] Instalar SDK: `npm install react-native-purchases`
- [ ] Configurar API keys en RevenueCat dashboard
- [ ] Crear al menos 1 producto de suscripcion (ej: "Pro Monthly")
- [ ] Configurar producto en App Store Connect / Google Play Console
- [ ] Implementar paywall basico en la app
- [ ] Conectar el paywall con features existentes (ej: limitar Cloud Function calls para free tier)

**Modelo de monetizacion sugerido:**
```
FREE:
  - 5 escaneos OCR/mes
  - 5 sugerencias de recetas/mes
  - Inventario basico

PRO ($4.99/mes):
  - Escaneos ilimitados
  - Recetas ilimitadas
  - Importar recetas desde URL
  - Lista de la compra
  - Sync entre dispositivos
```

**Archivos a crear/modificar:**
- `src/services/revenuecat/index.ts` - Inicializacion y config
- `src/hooks/useSubscription.ts` - Hook para estado de suscripcion
- `src/screens/PaywallScreen.tsx` - Pantalla de paywall
- `src/stores/useSubscriptionStore.ts` - Store Zustand
- `App.tsx` - Inicializar RevenueCat al arrancar

---

### 2. Build de TestFlight o Google Play Internal Testing - BLOQUEANTE

**Requisito del hackathon:**
> "Provide TestFlight or Google Play Internal Testing link to the working application"

**Estado:** No hay builds generados. Android casi listo, iOS necesita prebuild.

**Qué hacer:**
- [ ] Instalar EAS CLI: `npm install -g eas-cli`
- [ ] Crear `eas.json` con configuracion de builds
- [ ] Generar keystore para Android (o usar EAS managed)
- [ ] Generar certificados para iOS (requiere Apple Developer Account $99/year)
- [ ] Ejecutar build: `eas build --platform android` (o ios)
- [ ] Subir a Google Play Internal Testing o TestFlight
- [ ] Generar link de acceso para los jueces

**Opcion rapida (solo Android):**
```bash
eas build --platform android --profile preview
# Genera un APK/AAB que puedes subir a Google Play Internal Testing
```

**Opcion rapida (solo iOS):**
```bash
npx expo prebuild
eas build --platform ios --profile preview
# Genera un IPA que puedes subir a TestFlight
```

---

### 3. Video Demo - BLOQUEANTE

**Requisito del hackathon:**
> "Include a demonstration video... less than three (3) minutes... uploaded to YouTube, Vimeo, Facebook Video, or Youku"

**Estado:** No existe video demo.

**Qué hacer:**
- [ ] Grabar la app funcionando en dispositivo real o emulador
- [ ] Duracion: < 3 minutos
- [ ] Mostrar flujo completo: escanear ticket -> ver inventario -> obtener recetas -> importar receta desde URL -> paywall/suscripcion
- [ ] Subir a YouTube (publico o unlisted)
- [ ] Copiar link para Devpost

**Estructura sugerida del video (2:30 min):**
```
0:00 - 0:15  Intro: "What's in my Fridge" - problema que resuelve
0:15 - 0:40  Demo: Escanear ticket de supermercado (OCR)
0:40 - 1:00  Demo: Ver inventario con fechas de caducidad
1:00 - 1:30  Demo: Obtener recetas basadas en ingredientes
1:30 - 1:50  Demo: Importar receta desde URL (YouTube/Instagram)
1:50 - 2:10  Demo: Paywall / Suscripcion Pro con RevenueCat
2:10 - 2:30  Cierre: Tech stack + propuesta de valor
```

---

### 4. Submission en Devpost - BLOQUEANTE

**Requisito del hackathon:**
> "Complete and enter all of the required fields on the Enter a Submission page"

**Estado:** No hay submission creada.

**Qué hacer:**
- [ ] Registrarse en revenuecat-shipyard-2026.devpost.com
- [ ] Click en "Join Hackathon"
- [ ] Rellenar formulario de submission:
  - [ ] Nombre del proyecto
  - [ ] Texto descriptivo (Written Proposal + documentacion tecnica)
  - [ ] Link al video demo (YouTube)
  - [ ] Link a TestFlight o Google Play Internal Testing
  - [ ] Screenshots de la app
  - [ ] Tech stack utilizado
  - [ ] Seleccionar el influencer brief al que apunta

---

### 5. Influencer Brief - BLOQUEANTE

**Requisito del hackathon:**
> "built specifically for one of the influencer briefs"

**Estado:** No verificado. Necesitamos revisar los briefs disponibles en:
https://revenuecat-shipyard-2026.devpost.com/details/influencerbriefs

**Qué hacer:**
- [ ] Revisar los influencer briefs disponibles
- [ ] Elegir el brief que mejor encaje con "What's in my Fridge"
- [ ] Asegurarnos de que la app cumple con los requisitos especificos del brief elegido
- [ ] Adaptar la submission/video a ese brief concreto

---

## Criterios de Evaluacion del Jurado

| Criterio | Peso | Nuestro estado |
|----------|------|----------------|
| Audience Fit | 30% | Depende del brief elegido |
| User Experience | 25% | Bueno - 18 pantallas, flujo intuitivo |
| Monetization Potential | 20% | FALTA - Necesita RevenueCat |
| Innovation | 15% | Bueno - OCR + IA + URL parsing |
| Technical Quality | 10% | Bueno - Firebase + Cloud Run + WatermelonDB |

---

## Orden de Prioridad para HOY

```
PASO 1: Verificar influencer brief (15 min)
  └── Leer briefs y elegir uno compatible

PASO 2: Integrar RevenueCat SDK (2-3 horas)
  ├── Crear cuenta RevenueCat
  ├── Instalar SDK
  ├── Configurar productos
  └── Implementar paywall basico

PASO 3: Generar build (1-2 horas)
  ├── Configurar EAS
  ├── Build Android o iOS
  └── Subir a Google Play / TestFlight

PASO 4: Grabar video demo (30-45 min)
  ├── Grabar flujo completo en dispositivo
  └── Subir a YouTube

PASO 5: Submit en Devpost (30 min)
  ├── Rellenar todos los campos
  ├── Adjuntar links
  └── ENVIAR antes de 11:45 PM ET
```

---

## Requisitos Legales Cumplidos

- [x] Proyecto nuevo (creado durante el Submission Period: 15 ene - 12 feb)
- [x] Trabajo original propio
- [x] No usa contenido con copyright de terceros
- [x] Cumple con licencias open source
- [ ] Usa RevenueCat SDK (PENDIENTE)
- [ ] Tiene link de testing funcional (PENDIENTE)
- [ ] Video demo < 3 minutos (PENDIENTE)
- [ ] Materiales en ingles o con traduccion (PENDIENTE - la app esta en espanol)

**IMPORTANTE sobre idioma:**
> "All Submission materials must be in English or, if not in English, the Entrant must provide an English translation"

La app esta principalmente en espanol. Opciones:
1. Cambiar idioma de la app a ingles para el video/demo
2. Mantener espanol y proveer traduccion en la submission
