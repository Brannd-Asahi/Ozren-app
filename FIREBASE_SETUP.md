# Configurar Firebase para "Ozren" — guía paso a paso

## ¿Ya configuraste Firebase para Sattva? Lee esto primero

Si ya tienes un proyecto de Firebase funcionando para tu app de nutrición
(Sattva), **puedes reutilizarlo tal cual** — no necesitas crear un proyecto
nuevo ni una cuenta nueva. Solo copia el mismo objeto `firebaseConfig` que
usaste allá dentro del `firebase-config.js` de esta carpeta (Ozren), y ya
está. Un solo login te sirve para ambas apps, y guardan sus datos en
colecciones distintas dentro del mismo proyecto, sin mezclarse.

Si es así, salta directo al **paso 6** (autorizar el dominio) — los pasos
1 a 5 ya los hiciste con Sattva y no hace falta repetirlos.

Si es la primera vez que configuras Firebase, sigue todos los pasos desde el 1.

---

## 1. Crear el proyecto

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta de Google.
2. Click en **"Crear un proyecto"**.
3. Ponle un nombre, por ejemplo `ozren-app`.
4. Cuando te pregunte por Google Analytics, puedes **desactivarlo**.
5. Espera a que termine de crear el proyecto y entra a su panel.

## 2. Activar Authentication (para el login)

1. Menú izquierdo → **Build → Authentication → Get started**.
2. Activa **"Correo electrónico/contraseña"** (Enable → Guardar).
3. Activa también **"Google"** (Enable, elige tu correo como "Project
   support email" si te lo pide → Guardar).

## 3. Crear la base de datos (Firestore)

1. Menú izquierdo → **Build → Firestore Database → Create database**.
2. Elige una ubicación (cualquier región de Norteamérica o Sudamérica sirve).
3. Modo de seguridad inicial: **"Start in production mode"**.

## 4. Registrar la app web y obtener la configuración

1. Ícono de engranaje → **Project settings** → **Add app** → ícono web `</>`.
2. Apodo, por ejemplo `ozren-web`. **NO actives Firebase Hosting**.
3. Copia el bloque `firebaseConfig` que te muestra y pégalo en el archivo
   `firebase-config.js` de esta carpeta, reemplazando el de ejemplo.

## 5. Publicar las reglas de seguridad

1. **Build → Firestore Database → Rules**.
2. Borra lo que haya y pega el contenido completo de `firestore.rules`
   (el archivo que viene junto con esta app).
3. Click **"Publish"**.

## 6. Autorizar tu dominio de GitHub Pages

1. **Authentication → Settings → Authorized domains**.
2. **Add domain** → agrega tu dominio de GitHub Pages, por ejemplo
   `tu-usuario.github.io` (sin el `/ozren-app/` del final, solo el dominio).
3. Sin este paso, "Continuar con Google" falla — el login por
   correo/contraseña funciona igual sin este paso, pero Google no.

## 7. Crear tu cuenta dentro de la app

Abre la app ya publicada, toca **"Crear cuenta"**, y usa el correo y
contraseña que quieras usar en tus dos teléfonos (o el mismo que ya usas
en Sattva, si reutilizaste el proyecto — ahí ni siquiera necesitas crear
cuenta de nuevo, solo inicia sesión con la misma).

---

Si en algún punto Firebase te muestra una pantalla distinta a la que
describo (a veces cambian el diseño de la consola), dime exactamente qué
ves y seguimos desde ahí.
