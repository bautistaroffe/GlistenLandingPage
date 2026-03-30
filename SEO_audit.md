# Auditoria SEO - Glisten (www.glisten-limpieza.com)

**Fecha:** 2026-03-30

---

## 1. Mejoras inmediatas realizadas (sin necesidad de decision)

Las siguientes correcciones ya fueron aplicadas directamente en el codigo:

### 1.1 og:image con URL absoluta
- **Problema:** Todas las paginas usaban una ruta relativa (`/assets/images/fondo_link_favicon.png?v=2`) para `og:image`. Las redes sociales y Google no pueden resolver rutas relativas, resultando en previews rotas al compartir enlaces.
- **Correccion:** Cambiado a URL absoluta `https://www.glisten-limpieza.com/assets/images/fondo_link.png` en las 4 paginas. Ademas se uso `fondo_link.png` (la imagen grande) en lugar del favicon, que es demasiado pequeno para previews sociales.

### 1.2 Meta tags de Twitter Cards
- **Problema:** No existian meta tags `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` en ninguna pagina. Sin estos, Twitter/X muestra el enlace como texto plano sin preview visual.
- **Correccion:** Agregados en las 4 paginas con `summary_large_image` y los datos correspondientes.

### 1.3 og:image:width y og:image:height
- **Problema:** Sin dimensiones declaradas, las plataformas sociales pueden tardar en procesar la imagen o mostrarla incorrectamente.
- **Correccion:** Agregados `og:image:width` (1200) y `og:image:height` (630) en las 4 paginas.

### 1.4 Meta tag `robots`
- **Problema:** Ninguna pagina tenia `<meta name="robots" content="index, follow"/>`. Si bien Google indexa por defecto, declararlo explicitamente refuerza la intencion y evita ambiguedad.
- **Correccion:** Agregado en las 4 paginas.

### 1.5 Title de index.html mejorado
- **Problema:** El `<title>` de la pagina principal era solo "Glisten", sin palabras clave. Google favorece titles descriptivos con la actividad y ubicacion.
- **Correccion:** Cambiado a "Glisten | Limpieza Profesional en Buenos Aires" (y actualizado `og:title` para que coincida).

### 1.6 Atributo `class="light"` faltante
- **Problema:** `solicita-presupuesto.html` y `trabaja-con-nosotros.html` no tenian `class="light"` en `<html>`, mientras que `index.html` y `contacto.html` si. Esto podia causar inconsistencias visuales con Tailwind `darkMode: "class"`.
- **Correccion:** Agregado `class="light"` a ambos archivos.

### 1.7 Sitemap.xml mejorado
- **Problema:** El sitemap solo tenia `<loc>` sin `<lastmod>`, `<changefreq>` ni `<priority>`. Google usa `<lastmod>` para decidir cuando re-rastrear paginas.
- **Correccion:** Agregados `<lastmod>` (2026-03-30), `<changefreq>` (monthly) y `<priority>` (1.0 para home, 0.9 para presupuesto, 0.8 para contacto, 0.7 para empleo).

### 1.8 Redireccion non-www a www
- **Problema:** No habia una redireccion 301 de `glisten-limpieza.com` (sin www) a `www.glisten-limpieza.com`. Google puede estar indexando ambas versiones como sitios separados, causando contenido duplicado y problemas de indexacion.
- **Correccion:** Agregada regla de redireccion 301 en `netlify.toml`.

### 1.9 Datos estructurados JSON-LD
- **Problema:** No existia markup de datos estructurados. Google usa Schema.org para rich snippets (mostrar direccion, horario, tipo de servicio directamente en los resultados de busqueda).
- **Correccion:** Agregado JSON-LD `LocalBusiness` en `index.html` con nombre, descripcion, URL, direccion, horario y tipos de servicio.

### 1.10 Headers de seguridad y SEO en Netlify
- **Problema:** No habia headers de seguridad configurados. Google penaliza sitios sin headers basicos de seguridad.
- **Correccion:** Agregados `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Content-Type` correcto para `sitemap.xml`.

---

## 2. Mejoras que requieren decision

### CRITICAS

#### 2.1 Verificar configuracion del dominio en Netlify Dashboard
- **Problema:** El problema de indexacion que reportas probablemente se deba a que el subdominio `.netlify.app` sigue activo y accesible. Google puede estar indexando esa version en lugar de `www.glisten-limpieza.com`.
- **Accion requerida:**
  1. Ir al dashboard de Netlify > Domain Management
  2. Verificar que `www.glisten-limpieza.com` es el dominio primario
  3. En la seccion del subdominio `.netlify.app`, **desactivar el acceso publico** o confirmar que redirige al dominio principal
  4. En Google Search Console, asegurarse de que la propiedad verificada sea `https://www.glisten-limpieza.com` (con www y https)
  5. Si hay una propiedad para el subdominio `.netlify.app`, solicitar la eliminacion de esas URLs del indice

#### 2.2 ~~Tailwind CSS via CDN en produccion~~ RESUELTO
- **Resuelto:** Tailwind ahora se compila localmente (~31KB minificado vs ~300KB+ del CDN). Se instalo como dependencia con plugins forms, typography y container-queries. Se usa sistema de CSS variables para temas por pagina.

#### 2.3 Google Search Console - Solicitar indexacion
- **Problema:** Despues de aplicar estas correcciones, es necesario notificar a Google.
- **Accion requerida:**
  1. Ir a Google Search Console > Inspeccion de URL
  2. Inspeccionar cada una de las 4 URLs del sitemap
  3. Solicitar indexacion para cada una
  4. Enviar el sitemap actualizado desde Sitemaps > Agregar sitemap

### PRIORIDAD MEDIA

#### 2.4 Imagen OG dedicada (1200x630)
- **Problema:** Actualmente se usa `fondo_link.png` como imagen OG. Lo ideal es tener una imagen especificamente disenada de 1200x630px con el logo de Glisten, un tagline y colores de marca. Esto mejora CTR en redes sociales y Google Discover.
- **Accion:** Disenar una imagen OG profesional y reemplazar la referencia.

#### 2.5 ~~Imagenes externas en Google CDN~~ RESUELTO
- **Resuelto:** Las 4 imagenes externas fueron descargadas y hospedadas localmente: `servicio-oficinas.jpg`, `servicio-clinicas.jpg`, `servicio-comercial.jpg`, `fondo-trabaja.jpg`. Referencias actualizadas en `index.html` y `trabaja-con-nosotros.html`.

#### 2.6 Telefono y email de contacto faltantes
- **Problema:** La pagina de contacto no muestra telefono ni email. Google Search valora esta informacion para negocios locales (NAP: Name, Address, Phone). Sin telefono/email, el schema LocalBusiness queda incompleto.
- **Accion:** Agregar al menos un telefono y email publico en la pagina de contacto y en el JSON-LD.

#### 2.7 Google Business Profile
- **Problema:** No hay evidencia de integracion con Google Business Profile (antes Google My Business). Para SEO local, es fundamental tener un perfil verificado que enlace al sitio web.
- **Accion:** Crear o verificar el perfil de Google Business con la misma direccion, telefono y URL del sitio.

### PRIORIDAD BAJA

#### 2.8 ~~Preconnect para recursos externos~~ RESUELTO
- **Resuelto:** Agregados `<link rel="preconnect">` para `fonts.googleapis.com` y `fonts.gstatic.com` en las 4 paginas.

#### 2.9 Pagina 404 personalizada
- **Problema:** No existe una pagina 404 personalizada. Los usuarios que llegan a URLs invalidas ven la pagina generica de Netlify, perdiendo la oportunidad de redirigirlos al sitio.
- **Accion:** Crear `public/404.html` con navegacion del sitio y enlace al home.

#### 2.10 Atributos alt mas descriptivos en imagenes
- **Problema:** Algunas imagenes tienen alt genericos como "Fondo inicio", "Sobre nosotros". Para SEO de imagenes, es mejor ser descriptivo: "Equipo de limpieza profesional Glisten trabajando en oficina".
- **Accion:** Reescribir los atributos alt con descripciones mas especificas que incluyan palabras clave relevantes.

#### 2.11 Links internos con trailing slash
- **Problema:** Los enlaces internos no usan trailing slash (`/contacto` vs `/contacto/`). Si bien Netlify maneja ambos, Google puede verlos como URLs distintas.
- **Accion:** Elegir una convencion (con o sin trailing slash) y aplicarla consistentemente en todos los enlaces, canonicals y sitemap.

#### 2.12 CSS custom no utilizado
- **Problema:** El archivo `public/assets/css/styles.css` contiene estilos de un diseno anterior (`.hero`, `.card`, `.about`, `.nav-links`, etc.) que no se usan en las paginas actuales basadas en Tailwind. Es un archivo de ~335 lineas que no se referencia en ninguna pagina HTML actual.
- **Accion:** Verificar si se usa en algun lugar no identificado. Si no se usa, eliminarlo para reducir confusiones de mantenimiento.

---

## 3. Indicaciones para ti

### Pasos inmediatos (hacer ahora):

1. **Hacer deploy** de los cambios que ya aplique (push a main para que Netlify reconstruya).
2. **Verificar en Netlify Dashboard** que el subdominio `.netlify.app` redirige al dominio principal (ver seccion 2.1). Esta es la causa mas probable del problema de indexacion.
3. **Ir a Google Search Console:**
   - Verificar que la propiedad sea `https://www.glisten-limpieza.com` (con www y https)
   - Enviar el sitemap actualizado
   - Inspeccionar y solicitar re-indexacion de las 4 URLs
   - Revisar la seccion "Cobertura" para ver que URLs estan siendo redirigidas o marcadas como duplicadas

### Despues del deploy:

4. **Testear las correcciones:**
   - Verificar que `https://glisten-limpieza.com` (sin www) redirige a `https://www.glisten-limpieza.com`
   - Verificar que el subdominio `.netlify.app` ya no es accesible o redirige
   - Testear las previews OG en https://developers.facebook.com/tools/debug/ y https://cards-dev.twitter.com/validator
   - Validar datos estructurados en https://search.google.com/test/rich-results

### A mediano plazo:

5. ~~**Reemplazar Tailwind CDN**~~ YA RESUELTO - Tailwind compilado localmente (~31KB).
6. **Crear imagen OG profesional** de 1200x630px.
7. **Agregar telefono y email** a la pagina de contacto.
8. **Configurar Google Business Profile** si no esta activo.

### Nota sobre el build:

- Para compilar el CSS de Tailwind: `npm run build:css`
- Para desarrollo con watch: `npm run watch:css`
- Netlify ejecuta `npm run build:css` automaticamente en cada deploy (configurado en `netlify.toml`)
- El archivo compilado `public/assets/css/tailwind.css` debe incluirse en git o generarse en el build de Netlify
