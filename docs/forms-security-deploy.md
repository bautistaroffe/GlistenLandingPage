# Formularios: seguridad y deploy

## Objetivo

Este proyecto deja endurecidos los formularios tanto en desarrollo local como en deploy serverless.

Se cubren:
- Honeypot anti-bot
- Control de tiempo minimo de llenado
- Validacion y sanitizacion server-side
- Rate limit por IP
- Restriccion por `ALLOWED_ORIGINS`
- Destinatario ocultable con `MAIL_TO_ENCRYPTED`
- Validacion de adjuntos por extension, MIME, tamano y firma
- Respuestas de error seguras sin detalles internos

## Variables de entorno

```env
PORT=3000
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=usuario_smtp
SMTP_PASS=clave_smtp
MAIL_FROM=web@inforce-seguridad.com.ar
MAIL_TO=web@inforce-seguridad.com.ar
ALLOWED_ORIGINS=https://tu-sitio.netlify.app,https://tudominio.com,http://localhost:3000,http://localhost:8888
MAIL_TO_ENCRYPTED=
MAIL_TO_KEY=
MIN_FILL_TIME_MS=1500
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=8
MAX_CV_SIZE_BYTES=2097152
```

Notas:
- Usar `MAIL_TO` o bien `MAIL_TO_ENCRYPTED + MAIL_TO_KEY`.
- `ALLOWED_ORIGINS` debe ser una lista explicita separada por comas.
- `MAX_CV_SIZE_BYTES` controla el limite en local y en Netlify.

## Deploy en Netlify

- Publish directory: `public`
- Functions directory: `netlify/functions`
- Build command: vacio
- Redirects API: definidos en `netlify.toml`

## Seguridad aplicada

### Cliente
- Se agrega honeypot oculto
- Se agrega `formStartedAt`
- Los formularios envian con `FormData`
- El formulario de CV muestra feedback del archivo seleccionado

### Backend local
- Valida honeypot y timestamp
- Valida origen con `ALLOWED_ORIGINS`
- Rate limit por IP
- Sanitiza todos los campos antes de armar el email
- No expone `detail` de errores internos
- Valida CV por extension, MIME, tamano y firma

### Backend Netlify
- Aplica las mismas reglas en `netlify/functions/_shared.js`

## Checklist manual de validacion

### Solicitud de presupuesto
1. Abrir `/solicita-presupuesto`
2. Enviar sin nombre: debe responder error de validacion
3. Enviar con email invalido: debe responder error de validacion
4. Enviar con consulta menor a 10 caracteres: debe responder error
5. Enviar correctamente: debe llegar correo y devolver mensaje OK

### Trabaja con nosotros
1. Abrir `/trabaja-con-nosotros`
2. Enviar sin CV: debe responder error
3. Enviar un archivo mayor al limite: debe responder error
4. Enviar archivo con extension invalida: debe responder error
5. Enviar PDF o DOCX valido: debe llegar correo con adjunto

### Anti-bot
1. Enviar demasiado rapido alterando `formStartedAt`: debe bloquear
2. Completar el honeypot `website`: debe bloquear

### Origen
1. Probar desde un origen no listado en `ALLOWED_ORIGINS`: debe responder `403`

### Rate limit
1. Superar `RATE_LIMIT_MAX` dentro de `RATE_LIMIT_WINDOW_MS`: debe responder `429`

## Archivos clave

- `public/assets/js/main.js`
- `server.js`
- `netlify/functions/_shared.js`
- `netlify/functions/solicitar-presupuesto.js`
- `netlify/functions/trabaja-con-nosotros.js`
- `.env.example`
- `netlify.toml`
