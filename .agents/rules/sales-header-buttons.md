# Regla de Diseño y Estructura: Botones de Encabezado en Ventas e Historial

Esta regla es de cumplimiento estricto y define la disposición permanente de los botones en el módulo de Ventas y su subvista de Historial en **Market Almacén**.

---

## 1. Orden Estricto de los Botones
En la barra superior de encabezado de **Terminal POS** y de **Historial de Ventas**, el orden debe ser invariablemente:

1. **Segmented Switcher de Vistas**:
   - `[🛒 Terminal POS | 💵 Historial (N)]`
2. **Botón de Cierre de Caja**:
   - `[🔒 Cierre (Z)]`
3. **Botón de Configuración Fiscal**:
   - `[⚙️ SII]`

---

## 2. Alineación y Regla de Posición Absoluta
- **"Los botones del menú de ventas mandan"**: La posición geométrica de los botones la dicta el Menú de Ventas (Terminal POS).
- En ambas subvistas (**Terminal POS** e **Historial**), el encabezado debe estar contenido dentro de la misma cuadrícula y columna:
  ```tsx
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
    <div className="lg:col-span-7 xl:col-span-8">
      <div className={`p-2.5 sm:p-3 rounded-2xl border ${themeClasses.card} shadow-xs flex flex-wrap items-center justify-between gap-2`}>
        {/* Título a la izquierda */}
        {/* Botones [Terminal POS | Historial] [Cierre (Z)] [SII] a la derecha */}
      </div>
    </div>
  </div>
  ```
- **Prohibido el Desplazamiento**: Al alternar entre Terminal POS e Historial, los botones deben permanecer exactamente en la misma coordenada horizontal de la pantalla. No deben saltar al borde derecho de la ventana.

---

## 3. Restricciones Permanentes
- **NO agregar `Borrar Historial` a la barra superior**: Las cancelaciones o anulaciones de comprobantes se gestionan individualmente en la tarjeta de cada venta/boleta.
- **NO agregar `Informes` a la barra superior de ventas**: El acceso al **Menú de Informes** se encuentra centralizado exclusivamente dentro del botón de sesión de usuario en la esquina superior derecha del Navbar.
