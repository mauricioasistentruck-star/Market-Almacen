# Guía Paso a Paso: Configuración de Nueva Cuenta en Supabase y Netlify

Esta guía te explica cómo tener **Market Almacén** funcionando en la Web y en la APK Android trabajando en paralelo y sincronizados en tiempo real mediante una nueva cuenta 100% independiente.

---

## PARTE 1: Crear tu Nueva Cuenta de Supabase (Base de Datos y Nube)

Supabase es el servicio en la nube (gratuito) que permite que la Web y la APK se sincronicen en tiempo real.

### Paso 1: Registro
1. Ingresa a [https://supabase.com/](https://supabase.com/).
2. Haz clic en **Start your project** o **Sign In** (puedes entrar con tu cuenta de GitHub o con tu correo electrónico).

### Paso 2: Crear el Nuevo Proyecto
1. En el panel principal, haz clic en el botón verde **"New Project"**.
2. Completa los campos:
   - **Name**: `Market Almacén`
   - **Database Password**: Genera una contraseña segura y guárdala.
   - **Region**: Elige la más cercana (por ejemplo: *South America - São Paulo* o *East US*).
   - **Pricing Plan**: Free (Gratis).
3. Haz clic en **"Create new project"** y espera 1 minuto mientras se inicializa.

### Paso 3: Ejecutar el archivo SQL
1. En el menú de la izquierda de Supabase, entra en **SQL Editor** (ícono `>_`).
2. Haz clic en **"New query"**.
3. Abre el archivo `supabase_setup.sql` que está en la carpeta de este proyecto, copia todo su contenido y pégalo en la ventana de Supabase.
4. Presiona el botón verde **"Run"** (o presiona `Ctrl + Enter`).
5. Verás el mensaje: `Success. No rows returned`. ¡La base de datos ya está lista!

### Paso 4: Obtener tus Claves de Conexión
1. En el menú de la izquierda, haz clic en el ícono de engranaje **Project Settings** (abajo a la izquierda).
2. Haz clic en la sección **API**.
3. Verás dos valores:
   - **Project URL**: Ejemplo: `https://abcdefghijk.supabase.co`
   - **Project API keys (anon / public)**: Ejemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`
4. ¡Copia ambos valores! Puedes ingresarlos en la aplicación en la sección de Configuración o definirlos en las variables del proyecto.

---

## PARTE 2: Crear tu Nueva Cuenta y Desplegar en Netlify (Página Web)

Netlify te permite publicar la página web gratis en segundos.

### Opción Rápida (Netlify Drop - Sin código):
1. Inicia sesión o regístrate en [https://app.netlify.com/](https://app.netlify.com/).
2. Ve a [https://app.netlify.com/drop](https://app.netlify.com/drop).
3. Arrastra directamente el archivo **`Market-Almacen-Web-Deploy.zip`** o la carpeta **`dist`** sobre la página web de Netlify Drop.
4. En 10 segundos tu sitio estará en línea con un enlace público (ej: `https://market-almacen.netlify.app`).
5. En las opciones de Netlify puedes cambiarle el nombre al enlace por el que prefieras (ej: `mi-almacen.netlify.app`).

---

## PARTE 3: Conexión y Trabajo en Paralelo (APK + Web)

1. **Instala la APK**: Pasa el archivo `Market-Almacen.apk` a tu celular o tablet Android e instálalo.
2. **Abre la Web**: Ingresa a tu enlace de Netlify desde cualquier computador o celular.
3. Ambas aplicaciones compartirán la misma información (ventas, boletas, inventario, bitácora, herramientas) a través de tu nueva base de datos de Supabase sin cruzarse jamás con ningún proyecto anterior.
4. Si trabajas sin internet, los datos se guardan de forma segura en el dispositivo y se sincronizan automáticamente en cuanto vuelva la conexión.
