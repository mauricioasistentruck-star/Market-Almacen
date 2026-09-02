# Guía de Despliegue: Railway.app y Supabase (Market Almacén / Bodega 2)

Esta guía detalla los pasos para conectar tu nueva cuenta de **Supabase** y desplegar la aplicación web en **Railway.app**, además de cómo se compila y actualiza el **APK de Android**.

---

## 1. Configuración de la Nueva Cuenta en Supabase

1. **Crear Proyecto**:
   - Ingresa a [https://supabase.com](https://supabase.com) e inicia sesión.
   - Haz clic en **"New Project"**.
   - Asigna un nombre (ej: `bodega2-almacen`), define una contraseña de base de datos segura y elige la región más cercana (ej: *Sao Paulo* o *East US*).
   - Presiona **"Create new project"** y espera 1 a 2 minutos.

2. **Ejecutar el Script SQL**:
   - En el menú lateral izquierdo de Supabase, entra a **SQL Editor** (ícono `>_`).
   - Haz clic en **"New query"**.
   - Copia todo el contenido del archivo **`supabase_setup.sql`** (ubicado en la carpeta del proyecto) y pégalo en el editor.
   - Presiona **Run** (botón verde). Deberá indicar *"Success. No rows returned"*.
   - *(Opcional - Si utilizas folios CAF multi-empresa)*: Ejecuta también el script en **`supabase/migrations/20260901_caf_folios_multi_tenant.sql`**.

3. **Copiar las Credenciales**:
   - Ve a **Project Settings** (ícono de engranaje) -> **API**.
   - Copia los siguientes dos valores:
     - **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
     - **Project API Keys (anon / public)**: `eyJhbGciOi...`

---

## 2. Despliegue en Railway.app

El proyecto ya incluye los archivos necesarios para Railway:
- **`railway.json`**: Configurado con builder NIXPACKS, build command `npm run build` y start `npm start`.
- **`Procfile`**: Declaración `web: npm start`.
- **`server.js`**: Servidor Express listo para producción escuchando en `process.env.PORT`.

### Despliegue mediante GitHub (Recomendado)
1. Sube este proyecto a tu repositorio de GitHub:
```bash
git add .
git commit -m "Preparar proyecto para Railway y nueva cuenta Supabase"
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git branch -M main
git push -u origin main
```
2. Entra a [https://railway.app](https://railway.app) e inicia sesión con GitHub.
3. Haz clic en **"New Project"** -> **"Deploy from GitHub repo"**.
4. Selecciona el repositorio que acabas de subir.
5. Railway detectará automáticamente la configuración y comenzará la compilación.
6. En la pestaña **Settings** del servicio en Railway, ve a la sección **Networking** y haz clic en **"Generate Domain"** para obtener tu enlace web público (ej: `https://market-almacen-production.up.railway.app`).

### Variables de Entorno en Railway (Opcional)
En la pestaña **Variables** de tu servicio en Railway, puedes agregar:
- `VITE_SUPABASE_URL`: Tu Project URL de Supabase.
- `VITE_SUPABASE_KEY`: Tu anon public key de Supabase.

*(Nota: Si no las agregas como variables de entorno, igualmente puedes conectar la base de datos desde la misma aplicación haciendo clic en el botón "Conectar Nube" en la barra superior).*

---

## 3. Actualización y Generación del APK (Android)

Cuando termines de solicitar los cambios y requerimientos para la app:

1. **Compilar y Sincronizar**:
```cmd
npm run build
npx cap sync android
```

2. **Generar APK**:
```cmd
cd android
gradlew assembleDebug
```

3. **Ubicación del APK Generado**:
   - `android/app/build/outputs/apk/debug/app-debug.apk`
   - Este archivo se puede transferir e instalar directamente en cualquier teléfono o tablet Android.
