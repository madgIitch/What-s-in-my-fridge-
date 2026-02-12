# RevenueCat Setup (Hackathon)

Este proyecto ya tiene integrada la base técnica de RevenueCat en código.
Solo falta completar la configuración en paneles externos y variables.

## 1) Variables de entorno

En `.env`:

```env
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro
```

Notas:
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` debe coincidir con el entitlement activo en RevenueCat.
- En este proyecto el default es `pro`.

## 2) RevenueCat Dashboard

1. Crear proyecto en https://app.revenuecat.com
2. Añadir app Android:
   - Android: package name real del app
3. Crear Entitlement:
   - Id: `pro`
4. Crear Offering:
   - Id recomendado: `default`
   - Marcarlo como `Current`
5. Crear Package dentro del offering:
   - `$rc_monthly` (o custom)
   - Asociar producto mensual (ej: `neverito_pro_monthly`)

## 3) Store (Google Play)

- Android (Play Console):
  - Suscripción: `neverito_pro_monthly`
  - Estado: Activa y disponible en país de test

Después, vincular ese product en RevenueCat.

## 4) Flujo en app (ya integrado)

- Inicialización SDK: `App.tsx`
- Servicio RevenueCat: `src/services/revenuecat/index.ts`
- Estado de suscripción: `src/stores/useSubscriptionStore.ts`
- Hook de suscripción: `src/hooks/useSubscription.ts`
- Paywall: `src/screens/PaywallScreen.tsx`

## 5) Gating ya aplicado

- Recetas IA (Free 5/mes): `src/hooks/useRecipes.ts`
- OCR escaneo (Free 5/mes): `src/screens/ScanScreen.tsx`
- Recetas por URL (solo Pro): `src/screens/RecipesProScreen.tsx`, `src/screens/AddRecipeFromUrlScreen.tsx`

## 6) Validación rápida

1. Abrir app y entrar a `Paywall`.
2. Confirmar que aparecen packages (offering actual).
3. Probar compra sandbox/test.
4. Verificar:
   - `isPro` cambia a `true`
   - se desbloquea URL recipes
   - límites Free dejan de aplicar
5. Probar `Restaurar compras`.

## 7) Errores típicos

- No aparecen packages:
  - API key incorrecta
  - Offering sin `Current`
  - Productos no aprobados/activos en store
- Compra no activa tras pagar:
  - Entitlement no asociado al product
  - Product id distinto entre store y RevenueCat
