# Ozren — v2.0 (con sincronización)

App de rutina de entrenamiento, PWA instalable, con datos en Firebase
(Authentication + Firestore) para que se sincronicen automáticamente entre
tus dispositivos.

## Antes de publicarla: configura Firebase

La app no funciona todavía porque `firebase-config.js` tiene datos de
ejemplo. Sigue **`FIREBASE_SETUP.md`** paso a paso y:

1. Reemplaza el contenido de `firebase-config.js` con tu configuración real
   (o el mismo que ya usas en Sattva, si quieres compartir un solo login).
2. Publica las reglas de `firestore.rules` en la consola de Firebase
   (si ya las publicaste con Sattva usando el mismo patrón, no hace falta
   repetirlo).

Sin esto, la pantalla de inicio de sesión carga pero no puede crear tu
cuenta ni guardar nada.

## Cómo publicarla (GitHub Pages)

Mismo flujo que ya usaste con la versión anterior: GitHub Desktop → copiar
estos archivos dentro del repositorio local → Commit → Push → activar
Pages en Settings.

No olvides el paso 6 de `FIREBASE_SETUP.md` (autorizar el dominio de
GitHub Pages en Firebase) — sin eso, el botón de Google falla.

## Qué cambió en esta versión

- **Sincronización real** entre dispositivos vía Firebase — inicia sesión
  con el mismo correo en cualquier teléfono y tu historial aparece ahí.
- Funciona offline: los cambios se guardan localmente y se sincronizan
  solos al recuperar conexión.
- Letras más grandes en toda la app.
- Botón "Completar sesión" fijo en la parte inferior, siempre visible.
- Cronómetro: azul mientras cuenta, rojo con alarma continua al terminar
  hasta que lo detienes manualmente (nota: el navegador no puede forzar el
  volumen del sistema, solo suena al volumen más alto posible dentro del
  volumen que ya tenga el teléfono).
- Ejercicios de un solo lado (zancada búlgara, step-ups, remo a una mano,
  curl predicador, curl concentrado, zancada lateral) ahora preguntan si
  los hiciste alternado o simultáneo, y ajustan las casillas de marcar.
- Día de descanso (Día 4) ahora es una pestaña propia, con su propio botón
  de "Guardar registro" — así se distingue de un día que simplemente no
  registraste.
- Cada sección y ejercicio se colapsa solo al completarse.
- Gráfica simple de actividad de los últimos 14 días en el Historial.
- El día de hoy se selecciona automáticamente según el calendario (lunes →
  Día 1, jueves → Descanso, etc.), pero puedes tocar cualquier otro día
  cuando quieras.
- Exportar/importar respaldo en JSON, exportar historial en Excel.
