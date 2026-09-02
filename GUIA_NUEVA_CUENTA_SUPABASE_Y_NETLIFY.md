# Guia Oficial: Configuracion en Nuevas Cuentas de Supabase y Netlify

Esta guia explica paso a paso como poner en marcha **Market Almacen** en cuentas 100% nuevas e independientes de **Supabase** (para la base de datos y sincronizacion en tiempo real) y **Netlify** (para el alojamiento web).

---

## PARTE 1: Configurar la Nueva Cuenta en Supabase

Supabase provee la base de datos PostgreSQL en la nube para que computadores, tablets y celulares Android sincronicen ventas, inventario y registros en tiempo real.

### Paso 1: Registro y Acceso
1. Ingresa a [https://supabase.com/](https://supabase.com/).
2. Haz clic en **Start your project** o **Sign In** (puedes registrarte gratis con tu correo o GitHub).

### Paso 2: Crear el Nuevo Proyecto
1. En el panel principal de Supabase, haz clic en el boton verde **"New Project"**.
2. Completa los campos:
   - **Name**: `Market Almacen` (o el nombre de tu preferencia).
   - **Database Password**: Define una contrasena segura y guardala en un lugar seguro.
   - **Region**: Selecciona la region geografica mas cercana a tus operaciones (por ejemplo: *South America - Sao Paulo* o *East US*).
   - **Pricing Plan**: Free (Gratuito).
3. Haz clic en **"Create new project"** y espera aproximadamente 1 a 2 minutos mientras el servidor se inicializa.

### Paso 3: Ejecutar el Script de Base de Datos (SQL)
1. En la barra lateral izquierda de Supabase, haz clic en el icono **SQL Editor** (`>_`).
2. Haz clic en **"New query"** (o en el boton `+`).
3. Abre el archivo **`supabase_setup.sql`** ubicado en la carpeta del proyecto, copia todo su contenido y pegalo en el editor SQL de Supabase.
4. Presiona el boton verde **"Run"** (o presiona `Ctrl + Enter`).
5. Veras el mensaje de confirmacion: `Success. No rows returned`. La base de datos ya cuenta con la tabla `sync_state`, politicas de seguridad RLS y el canal de tiempo real activo.

### Paso 4: Obtener las Credenciales de Conexion
1. En el menu lateral izquierdo, haz clic en el icono de engranaje **Project Settings** (en la esquina inferior izquierda).
2. Selecciona la pestaña **API**.
3. Copia y guarda los siguientes dos valores:
   - **Project URL**: Ejemplo `https://xxxxxxxxxxxxxxxx.supabase.co`
   - **Project API keys (anon / public)**: Ejemplo `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## PARTE 2: Conectar la Aplicacion a Supabase (Web y Android)

No requieres modificar codigo fuente para conectar clientes:

1. Abre la aplicacion (en el navegador web o en tu telefono/tablet Android con el APK instalado).
2. En la barra superior o en el menu de usuario, haz clic en el boton:
   👉 **`Conectar Nube`** (o **`Sincronizacion en la Nube`**).
3. Pega la **Project URL** y la llave publica **anon key** que obtuviste en Supabase.
4. Haz clic en **"Probar Conexion"** para verificar la comunicacion.
5. Haz clic en **"Guardar y Conectar"**.
6. El indicador cambiara de inmediato a **`Nube Activa`** (verde), iniciando la sincronizacion automatica de productos, ventas, guias, mermas y cierres de caja.

> **Nota para Netlify (Opcional)**: Si deseas que el sitio web se conecte de forma automatica sin que los usuarios deban ingresar credenciales, puedes agregar en Netlify (*Site configuration -> Environment variables*) las variables:
> - `VITE_SUPABASE_URL` = (tu Project URL de Supabase)
> - `VITE_SUPABASE_KEY` = (tu anon key de Supabase)
> Y volver a compilar.

---

## PARTE 3: Despliegue en Nueva Cuenta de Netlify (Web)

Netlify permite alojar la aplicacion web de forma gratuita y con certificado SSL (HTTPS) automatico.

### Opcion Recomendada: Netlify Drop (Subida Rapida en 1 Clic)
1. Inicia sesion o crea una cuenta gratis en [https://app.netlify.com/](https://app.netlify.com/).
2. En la carpeta del proyecto, haz doble clic en el archivo ejecutable:
   👉 **`subir_a_netlify.bat`**
   - Este script compila la aplicacion web con las ultimas optimizaciones, empaqueta el archivo **`Market-Almacen-Web-Deploy.zip`** y abre la pagina de [Netlify Drop](https://app.netlify.com/drop) en tu navegador.
3. Arrastra el archivo **`Market-Almacen-Web-Deploy.zip`** (o la carpeta `dist`) y sueltalo dentro del circulo de Netlify Drop.
4. En pocos segundos el sitio estara publicado y operativo en internet con una URL propia (ejemplo: `https://tu-almacen.netlify.app`).
5. En Netlify (*Site configuration -> Change site name*) puedes personalizar el nombre del subdominio segun tu negocio.

---

## PARTE 4: Archivo APK Android para Celulares y Tablets

- El archivo oficial e instalable para Android es:
  👉 **`Market-Almacen.apk`** (ubicado directamente en la raiz de esta carpeta).
- Transfiere este archivo a tus dispositivos moviles mediante WhatsApp, correo, Google Drive o cable USB.
- Abre el archivo en el dispositivo y presiona **"Instalar"**.
