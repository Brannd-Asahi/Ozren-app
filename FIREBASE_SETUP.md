# Configurar Firebase para "Ozren" — guía paso a paso

Tu `firebase-config.js` ya trae la configuración real de tu proyecto
(`askesis-f15e5`) — no necesitas tocar nada aquí a menos que crees un
proyecto nuevo en el futuro.

## Si algún día necesitas configurar uno nuevo

1. **console.firebase.google.com** → Crear proyecto.
2. **Build → Authentication** → activa "Correo electrónico/contraseña" y "Google".
3. **Build → Firestore Database** → Create database → modo producción.
4. **Project settings → Add app (web `</>`)** → copia el bloque `firebaseConfig` a `firebase-config.js`.
5. **Firestore Database → Rules** → pega el contenido de `firestore.rules` → Publish.
6. **Authentication → Settings → Authorized domains** → agrega tu dominio de GitHub Pages (ej. `tu-usuario.github.io`), sin esto el botón de Google falla.
7. Abre la app publicada, toca "Crear cuenta" con el correo y contraseña que quieras usar en todos tus teléfonos.
