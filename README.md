# Glisten Landing Page

Landing page multipagina para empresa de limpieza, con backend minimo en Node/Express para validar y enviar formularios por email via SMTP.

## Stack
- Frontend: HTML + Tailwind CDN + JS vanilla
- Backend: Node.js + Express
- Formularios: multer (archivo CV) + nodemailer (envio de correo)

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
FORMS_TO_EMAIL=destino@empresa.com
FORMS_FROM_EMAIL=no-reply@empresa.com
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=usuario_smtp
SMTP_PASS=clave_smtp
```

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
Endpoint unico:
- `POST /api/forms/:type`

Tipos:
- `job`: requiere `fullName`, `email`, `phone` y opcional `cv`
- `quote`: requiere `fullName`, `email`, `message`

Respuestas:
- `200`: envio correcto
- `400`: validacion
- `500`: error de configuracion SMTP o envio

## Estructura del proyecto
```text
.
├─ public/
│  ├─ assets/
│  │  ├─ images/
│  │  └─ js/
│  ├─ index.html
│  ├─ trabaja-con-nosotros.html
│  ├─ solicita-presupuesto.html
│  └─ contacto.html
├─ server.js
├─ .env.example
├─ package.json
└─ README.md
```

## Notas de mantenimiento
- Los colores globales estan en `public/assets/js/colors.js`.
- La validacion/envio de formularios del frontend esta en `public/assets/js/main.js`.
- Si el email no sale, validar primero `FORMS_TO_EMAIL` y luego credenciales SMTP.
