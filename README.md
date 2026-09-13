# Ozren — v4.0 (navegación real + temas corregidos + bug de auto-colapso resuelto)

## Tu firebase-config.js ya está configurado

Trae tu configuración real (proyecto `askesis-f15e5`) — no necesitas volver a pegarla.

## Cómo publicarla

Mismo flujo de siempre: GitHub Desktop → reemplaza el contenido de tu
repositorio local con estos archivos → Commit → Push. El `CACHE_NAME`
cambió a `ozren-v4`, así que la app va a descargar la versión nueva sola
la próxima vez que la abras. Si por algún motivo sigue viéndose la
anterior, borra los datos del sitio en Chrome una vez.

## Qué se corrigió en esta versión

- **Navegación real con botón atrás**: entrar a Configuración o Historial
  ahora empuja una entrada al historial del navegador — el botón atrás
  (físico o del navegador) te devuelve a la pantalla anterior, no te saca
  de la app. Además, cada una de esas dos pantallas tiene su propia
  flecha de "Volver" arriba. Si presionas atrás estando ya en la pantalla
  principal, aparece un aviso — "Presiona atrás de nuevo para salir" —
  y solo se cierra si lo confirmas con una segunda pulsación.
- **Bug de auto-colapso corregido de raíz**: la causa real era que cada
  vez que Firestore confirmaba un guardado (incluso los tuyos propios),
  la pantalla se reconstruía entera y todas las tarjetas volvían a su
  estado inicial cerrado — eso se sentía como "se cierra con solo marcar
  una serie". Ahora el estado de qué tienes abierto se recuerda entre
  esas actualizaciones, y el auto-colapso solo ocurre cuando el ejercicio
  está genuinamente completo al 100% (ambos lados si elegiste
  "Alternado" cuentan como una sola vía completa, nunca exige las dos).
- **Espaciado corregido**: "Estiramiento" ya no queda pegado al ejercicio
  anterior en ningún día.
- **Lunes y Martes ahora son dos días de descanso separados** en el
  Plan 2 (misma pantalla, registrados de forma independiente en el
  historial), y el selector de días en ambos planes siempre se ordena
  por el calendario real (Lunes → Domingo), no por el orden interno de
  los datos.
- **Ícono en Estiramiento** (🧘) y en Calentamiento (🔥).
- **Champán** y **Dorado Solar** se eliminaron por ser redundantes entre sí.
- **Japonés · Shu**: más presencia de rojo (bordes, textura de papel de
  fondo sutil) y un resplandor rojo/vinotinto muy sutil en los costados
  de cada menú desplegable abierto — se pierde automáticamente al
  completarse (el verde de "hecho" tiene prioridad).
- **Oro sobre negro**: mismo resplandor sutil, en dorado.
- **Neumorfismo**: el efecto de sombra suave ahora también envuelve la
  tarjeta de información del día y las secciones de calentamiento y
  estiramiento (antes solo estaba en cada ejercicio). Los botones
  (series, Alternado/Simultáneo, cronómetro) dentro de los menús
  abiertos ahora tienen el mismo efecto de luz e inset característico
  del estilo, en vez de verse planos.
