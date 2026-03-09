require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const RATE_LIMIT_STORE = new Map();

const MAX_CV_SIZE_BYTES = Number(process.env.MAX_CV_SIZE_BYTES || 2 * 1024 * 1024);
const MIN_FILL_TIME_MS = Number(process.env.MIN_FILL_TIME_MS || 1500);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 8);

const ALLOWED_CV_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);

const ALLOWED_CV_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CV_SIZE_BYTES,
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const ROUTES = {
  '/': 'index.html',
  '/trabaja-con-nosotros': 'trabaja-con-nosotros.html',
  '/solicita-presupuesto': 'solicita-presupuesto.html',
  '/contacto': 'contacto.html',
};

Object.entries(ROUTES).forEach(([route, file]) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

function parseAllowedOrigins() {
  return String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getRequestOrigin(req) {
  const origin = normalizeOrigin(req.get('origin'));
  if (origin) return origin;

  const referer = String(req.get('referer') || '').trim();
  if (!referer) return '';

  try {
    return normalizeOrigin(new URL(referer).origin);
  } catch {
    return '';
  }
}

function createCorsHeaders(req) {
  const origin = getRequestOrigin(req);
  const allowedOrigins = parseAllowedOrigins();

  if (!origin || allowedOrigins.length === 0 || !allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function isOriginAllowed(req) {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.length === 0) return true;

  const origin = getRequestOrigin(req);
  return !!origin && allowedOrigins.includes(origin);
}

function getClientIp(req) {
  const explicit = String(req.get('x-nf-client-connection-ip') || '').trim();
  if (explicit) return explicit;

  const forwarded = String(req.get('x-forwarded-for') || '').trim();
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();

  for (const [key, value] of RATE_LIMIT_STORE.entries()) {
    if (value.resetAt <= now) RATE_LIMIT_STORE.delete(key);
  }

  const current = RATE_LIMIT_STORE.get(ip);
  if (!current || current.resetAt <= now) {
    RATE_LIMIT_STORE.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { blocked: false };
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX) {
    return { blocked: true, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }

  return { blocked: false };
}

function sanitizeText(value, { max = 1000 } = {}) {
  const normalized = String(value || '').replace(/\u0000/g, '').trim();
  return normalized.slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

function toSingleLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validateCvFile(file) {
  if (!file) return { ok: true };

  const extension = path.extname(String(file.originalname || '')).toLowerCase();
  if (!ALLOWED_CV_EXTENSIONS.has(extension)) {
    return { ok: false, message: 'El CV debe ser PDF, DOC o DOCX.' };
  }

  const mime = String(file.mimetype || '').toLowerCase();
  if (!ALLOWED_CV_MIME_TYPES.has(mime)) {
    return { ok: false, message: 'Tipo de archivo de CV no permitido.' };
  }

  if (file.size > MAX_CV_SIZE_BYTES) {
    return { ok: false, message: 'El CV supera el tamano maximo permitido.' };
  }

  const signature = file.buffer.subarray(0, 8);
  const isPdf = signature.subarray(0, 5).toString('ascii') === '%PDF-';
  const isZip = signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const isDoc = signature.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

  if (extension === '.pdf' && !isPdf) {
    return { ok: false, message: 'Firma de archivo PDF invalida.' };
  }

  if (extension === '.docx' && !isZip) {
    return { ok: false, message: 'Firma de archivo DOCX invalida.' };
  }

  if (extension === '.doc' && !isDoc) {
    return { ok: false, message: 'Firma de archivo DOC invalida.' };
  }

  return { ok: true };
}

function decryptMailTo(encryptedValue, key) {
  const payload = String(encryptedValue || '').trim();
  const secret = String(key || '');
  if (!payload || !secret) return '';

  const keyBuffer = crypto.createHash('sha256').update(secret).digest();

  function decodeFlexible(value) {
    return Buffer.from(value, /^[0-9a-f]+$/i.test(value) ? 'hex' : 'base64');
  }

  function tryDecrypt(iv, encrypted, tag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8').trim();
  }

  const split = payload.split(':');
  if (split.length === 3) {
    const [ivPart, middlePart, endPart] = split;
    const iv = decodeFlexible(ivPart);
    const middle = decodeFlexible(middlePart);
    const end = decodeFlexible(endPart);

    try {
      return tryDecrypt(iv, middle, end);
    } catch {
      return tryDecrypt(iv, end, middle);
    }
  }

  const packed = Buffer.from(payload, 'base64');
  if (packed.length > 28) {
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    return tryDecrypt(iv, encrypted, tag);
  }

  return '';
}

function resolveMailTo() {
  const plain = sanitizeText(process.env.MAIL_TO, { max: 320 });
  if (plain) return plain;

  try {
    return sanitizeText(decryptMailTo(process.env.MAIL_TO_ENCRYPTED, process.env.MAIL_TO_KEY), { max: 320 });
  } catch {
    return '';
  }
}

function validateAntiBot(fields) {
  const honeypot = sanitizeText(fields.website || fields.company || '', { max: 128 });
  if (honeypot) {
    return { ok: false, status: 400, message: 'Solicitud rechazada.' };
  }

  const formStartedAt = Number(fields.formStartedAt || 0);
  if (!Number.isFinite(formStartedAt) || formStartedAt <= 0) {
    return { ok: false, status: 400, message: 'Falta metadata del formulario.' };
  }

  if (Date.now() - formStartedAt < MIN_FILL_TIME_MS) {
    return { ok: false, status: 400, message: 'El formulario se envio demasiado rapido.' };
  }

  return { ok: true };
}

function buildTransporter() {
  const host = sanitizeText(process.env.SMTP_HOST, { max: 255 });
  const port = Number(process.env.SMTP_PORT || 587);
  const user = sanitizeText(process.env.SMTP_USER, { max: 255 });
  const pass = process.env.SMTP_PASS || '';

  if (!host || !user || !pass || !Number.isFinite(port)) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function sendJson(res, statusCode, payload, req, extraHeaders = {}) {
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    ...createCorsHeaders(req),
    ...extraHeaders,
  });
  return res.status(statusCode).json(payload);
}

app.options('/api/forms/:type', (req, res) => {
  res.set(createCorsHeaders(req));
  return res.status(204).send('');
});

app.post('/api/forms/:type', (req, res) => {
  upload.single('cv')(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
        return sendJson(res, 400, { ok: false, message: 'El CV supera el tamano maximo permitido.' }, req);
      }

      return sendJson(res, 400, { ok: false, message: 'No se pudo procesar el archivo adjunto.' }, req);
    }

    if (!isOriginAllowed(req)) {
      return sendJson(res, 403, { ok: false, message: 'Origen no permitido.' }, req);
    }

    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(ip);
    if (rateLimit.blocked) {
      return sendJson(
        res,
        429,
        { ok: false, message: 'Demasiadas solicitudes. Intenta nuevamente mas tarde.' },
        req,
        { 'Retry-After': String(rateLimit.retryAfter || 60) },
      );
    }

    const antiBot = validateAntiBot(req.body || {});
    if (!antiBot.ok) {
      return sendJson(res, antiBot.status, { ok: false, message: antiBot.message }, req);
    }

    const type = req.params.type;
    const fullName = sanitizeText(req.body.fullName, { max: 120 });
    const email = sanitizeText(req.body.email, { max: 320 }).toLowerCase();

    if (fullName.length < 2) {
      return sendJson(res, 400, { ok: false, message: 'El nombre completo es obligatorio.' }, req);
    }

    if (!isValidEmail(email)) {
      return sendJson(res, 400, { ok: false, message: 'El email no es valido.' }, req);
    }

    let subject = '';
    let html = '';
    const attachments = [];

    if (type === 'quote') {
      const message = sanitizeText(req.body.message, { max: 2000 });
      if (message.length < 10) {
        return sendJson(
          res,
          400,
          { ok: false, message: 'La consulta es obligatoria y debe tener al menos 10 caracteres.' },
          req,
        );
      }

      subject = 'Glisten - consulta de cotizacion';
      html = [
        '<h2>Nueva solicitud de presupuesto</h2>',
        `<p><strong>Nombre:</strong> ${escapeHtml(fullName)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Consulta:</strong><br/>${nl2br(message)}</p>`,
        `<p><strong>IP:</strong> ${escapeHtml(ip)}</p>`,
      ].join('');
    } else if (type === 'job') {
      const phone = sanitizeText(req.body.phone, { max: 30 });
      if (phone.length < 6) {
        return sendJson(res, 400, { ok: false, message: 'El telefono es obligatorio.' }, req);
      }

      const cvCheck = validateCvFile(req.file);
      if (!cvCheck.ok) {
        return sendJson(res, 400, { ok: false, message: cvCheck.message }, req);
      }

      if (req.file) {
        attachments.push({
          filename: req.file.originalname,
          content: req.file.buffer,
          contentType: req.file.mimetype,
        });
      }

      subject = 'Glisten - nueva postulacion';
      html = [
        '<h2>Nueva postulacion</h2>',
        `<p><strong>Nombre:</strong> ${escapeHtml(fullName)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Telefono:</strong> ${escapeHtml(phone)}</p>`,
        `<p><strong>IP:</strong> ${escapeHtml(ip)}</p>`,
      ].join('');
    } else {
      return sendJson(res, 404, { ok: false, message: 'Tipo de formulario no soportado.' }, req);
    }

    const toEmail = resolveMailTo();
    const from = sanitizeText(process.env.MAIL_FROM || process.env.SMTP_USER, { max: 255 });

    if (!toEmail) {
      return sendJson(res, 500, { ok: false, message: 'No se configuro MAIL_TO o MAIL_TO_ENCRYPTED.' }, req);
    }

    if (!from) {
      return sendJson(res, 500, { ok: false, message: 'No se configuro MAIL_FROM o SMTP_USER.' }, req);
    }

    const transporter = buildTransporter();
    if (!transporter) {
      return sendJson(res, 500, { ok: false, message: 'Faltan credenciales SMTP validas.' }, req);
    }

    try {
      await transporter.sendMail({
        from,
        to: toEmail,
        replyTo: email,
        subject,
        html,
        attachments,
      });

      return sendJson(res, 200, { ok: true, message: 'Formulario enviado correctamente.' }, req);
    } catch {
      return sendJson(res, 500, { ok: false, message: 'Error enviando el correo.' }, req);
    }
  });
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
