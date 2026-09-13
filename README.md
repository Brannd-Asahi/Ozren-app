# Ozren — v3.0 (multi-plan + temas + sync en tiempo real)

App de rutina de entrenamiento, PWA instalable, con Firebase (Authentication
+ Firestore) para sincronización en tiempo real entre tus dispositivos.

## Tu firebase-config.js ya está configurado

Este paquete ya trae tu configuración real de Firebase (proyecto
`askesis-f15e5`) — no necesitas volver a pegarla. Si vas a crear un
proyecto nuevo en el futuro, sigue `FIREBASE_SETUP.md`.

## Cómo publicarla (GitHub Pages)

Mismo flujo de siempre: GitHub Desktop → reemplaza el contenido de tu
repositorio local con estos archivos → Commit → Push. Como cambió el
`CACHE_NAME` del service worker (a `ozren-v3`), la próxima vez que abras
la app va a descargar la versión nueva sola — si por algún motivo sigue
viéndose la vieja, borra los datos del sitio en Chrome una vez.

## Qué cambió en esta versión

- **Dos planes de entrenamiento**, elegibles desde Configuración:
  - **Plan 1** — tu rutina original de 6 días (Empuje/Tracción/Pierna x2),
    conservada como archivo histórico.
  - **Plan 2** — tu rutina actual de 4 días (Superior/Inferior x2, Miércoles
    a Domingo) más un día opcional el Jueves. Activo por defecto.
  - Cambiar de plan sincroniza en tiempo real entre tus teléfonos.
- **7 temas visuales**, recreados a partir de la paleta real de Sattva:
  Tema Base, Japonés · Shu, Oro sobre negro, Neumorfismo soft UI,
  Champán · luz de día, Dorado Solar, Dashboard completo.
- **Menú (⋮) reorganizado**: ahora abre un pequeño selector con
  "Configuración" e "Historial", en vez de mezclar todo en una sola hoja.
  Configuración agrupa cuenta, plan activo, tema, y exportar/importar.
- **Selector de día sutil**: un botón ovalado discreto con el día y tipo
  de entrenamiento (ej. "Miércoles · Superior A") — tócalo para cambiar
  manualmente. La app sigue auto-seleccionando el día real por defecto.
- **Botón "Terminar entrenamiento"** ya no flota — vive en el flujo normal
  de la página, justo después de "Estiramiento". Solo se llega a él
  deslizando hasta el final real de la página.
- **Cronómetro**: azul mientras cuenta, rojo con alarma continua (sonido +
  vibración cada 1.6s) al terminar, hasta que la detienes manualmente.
- **Mostrar/ocultar contraseña** con el ícono de ojo en el login.
- **Ejercicios opcionales** (antebrazo/trapecio) en los días Superior,
  en su propia sección, sin contar para el progreso de la sesión.
- **Sincronización en tiempo real** para historial, configuración
  (tema/plan) y progreso del día en curso — si marcas algo en un teléfono
  mientras el mismo día está abierto en el otro, se actualiza solo.
