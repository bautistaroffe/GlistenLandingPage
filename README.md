# Glisten Landing Page

Landing page multipagina para empresa de limpieza. En deploy de Netlify, los formularios corren con Netlify Functions (serverless), manteniendo contrato API en `/api/...`.

## Stack
- Frontend: HTML + Tailwind CDN + JS vanilla
- Backend (local): Node.js + Express (`server.js`)
- Backend (Netlify): Netlify Functions (`netlify/functions`)
- Email: Nodemailer + SMTP

## Requisitos
- Node.js 18+
- npm

## Instalacion
```bash
npm install
```

## Variables de entorno
Copiar `.env.example` a `.env` y completar:

```env
PORT=3000
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=usuario_smtp
SMTP_PASS=clave_smtp
MAIL_FROM=no-reply@empresa.com
MAIL_TO=destino@empresa.com
ALLOWED_ORIGINS=https://www.glisten-limpieza.com,https://glisten-limpieza.com,http://localhost:3000
MAIL_TO_ENCRYPTED=
MAIL_TO_KEY=
MIN_FILL_TIME_MS=1500
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=8
MAX_CV_SIZE_BYTES=2097152
```

`MAIL_TO` puede reemplazarse por `MAIL_TO_ENCRYPTED + MAIL_TO_KEY`.

## Ejecutar en local
```bash
npm run dev
```
Servidor: `http://localhost:3000`

## Rutas web
- `/` -> Inicio
- `/trabaja-con-nosotros` -> Formulario de postulacion
- `/solicita-presupuesto` -> Formulario de presupuesto
- `/contacto` -> Datos de contacto + mapa

## API de formularios
Rutas compatibles:
- `POST /api/forms/quote` -> solicitud de presupuesto
- `POST /api/forms/job` -> trabaja con nosotros
- `POST /api/solicitar-presupuesto` -> alias Netlify
- `POST /api/trabaja-con-nosotros` -> alias Netlify

## Hardening aplicado (Netlify Functions)
- Validaciones estrictas server-side
- Anti-bot con honeypot + tiempo minimo de llenado
- Rate limit por IP en memoria de función
- Validacion de origen con `ALLOWED_ORIGINS`
- Validacion de CV por extension + MIME + firma basica
- Sanitizacion/escape para contenido de email
- Soporte de destinatario oculto con `MAIL_TO_ENCRYPTED` + `MAIL_TO_KEY`

## Configuracion Netlify
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Build command: vacio
- Base directory: `.` (o vacio)

## Estructura del proyecto
```text
.
+- netlify/
¦  +- functions/
¦     +- _shared.js
¦     +- solicitar-presupuesto.js
¦     +- trabaja-con-nosotros.js
+- public/
¦  +- assets/
¦  ¦  +- images/
¦  ¦  +- js/
¦  +- index.html
¦  +- trabaja-con-nosotros.html
¦  +- solicita-presupuesto.html
¦  +- contacto.html
+- netlify.toml
+- server.js
+- .env.example
+- package.json
+- README.md
```

