'use strict';

const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');

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

function parseAllowedOrigins() {
  return String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getHeader(headers, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === target) return value;
  }
  return '';
}

function getRequestOrigin(event) {
  const origin = getHeader(event.headers, 'origin');
  if (origin) return origin;

  const referer = getHeader(event.headers, 'referer');
  if (!referer) return '';

  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

function createCorsHeaders(event) {
  const origin = getRequestOrigin(event);
  const allowedOrigins = parseAllowedOrigins();

  if (!origin || allowedOrigins.length === 0) {
    return {
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  }

  if (!allowedOrigins.includes(origin)) {
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

function isOriginAllowed(event) {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.length === 0) return true;

  const origin = getRequestOrigin(event);
  return !!origin && allowedOrigins.includes(origin);
}

function getClientIp(event) {
  const explicit = getHeader(event.headers, 'x-nf-client-connection-ip');
  if (explicit) return explicit;

  const forwarded = getHeader(event.headers, 'x-forwarded-for');
  if (!forwarded) return 'unknown';

  return forwarded.split(',')[0].trim() || 'unknown';
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

function decodeBody(event) {
  if (!event.body) return Buffer.alloc(0);
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8');
}

function parseContentDisposition(value) {
  const items = String(value || '').split(';').map((part) => part.trim());
  const result = {};

  for (const item of items) {
    const idx = item.indexOf('=');
    if (idx === -1) continue;
    const key = item.slice(0, idx).trim().toLowerCase();
    const raw = item.slice(idx + 1).trim();
    result[key] = raw.replace(/^"|"$/g, '');
  }

  return result;
}

function parseMultipart(body, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType || '');
  if (!boundaryMatch) throw new Error('No se pudo leer el boundary del multipart/form-data.');

  const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '');
  const delimiter = `--${boundary}`;
  const bodyText = body.toString('latin1');
  const rawParts = bodyText.split(delimiter).slice(1, -1);

  const fields = {};
  let file = null;

  for (let rawPart of rawParts) {
    if (rawPart.startsWith('\r\n')) rawPart = rawPart.slice(2);
    if (rawPart.endsWith('\r\n')) rawPart = rawPart.slice(0, -2);

    const headerEndIndex = rawPart.indexOf('\r\n\r\n');
    if (headerEndIndex < 0) continue;

    const headerText = rawPart.slice(0, headerEndIndex);
    const payloadText = rawPart.slice(headerEndIndex + 4);

    const headers = {};
    for (const line of headerText.split('\r\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      headers[key] = value;
    }

    const disposition = parseContentDisposition(headers['content-disposition']);
    const name = disposition.name || '';
    if (!name) continue;

    const payloadBuffer = Buffer.from(payloadText, 'latin1');

    if (disposition.filename) {
      file = {
        fieldName: name,
        filename: path.basename(disposition.filename),
        contentType: headers['content-type'] || 'application/octet-stream',
        size: payloadBuffer.length,
        buffer: payloadBuffer,
      };
      continue;
    }

    fields[name] = payloadBuffer.toString('utf8').trim();
  }

  return { fields, file };
}

function parsePayload(event) {
  const contentType = String(getHeader(event.headers, 'content-type') || '').toLowerCase();
  const body = decodeBody(event);

  if (contentType.includes('multipart/form-data')) {
    return parseMultipart(body, contentType);
  }

  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(body.toString('utf8') || '{}');
    return { fields: parsed || {}, file: null };
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(body.toString('utf8'));
    const fields = {};
    for (const [key, value] of params.entries()) fields[key] = value;
    return { fields, file: null };
  }

  throw new Error('Tipo de contenido no soportado.');
}

function toSingleLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validateCvFile(file) {
  if (!file) return { ok: true };

  const extension = path.extname(String(file.filename || '')).toLowerCase();
  if (!ALLOWED_CV_EXTENSIONS.has(extension)) {
    return { ok: false, message: 'El CV debe ser PDF, DOC o DOCX.' };
  }

  const mime = String(file.contentType || '').toLowerCase();
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

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8').trim();
  }

  return '';
}

function resolveMailTo() {
  const plain = sanitizeText(process.env.MAIL_TO, { max: 320 });
  if (plain) return plain;

  try {
    const decrypted = decryptMailTo(process.env.MAIL_TO_ENCRYPTED, process.env.MAIL_TO_KEY);
    return sanitizeText(decrypted, { max: 320 });
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

function response(statusCode, payload, event, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...createCorsHeaders(event),
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

async function handleFormSubmission(event, type) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: createCorsHeaders(event), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { ok: false, message: 'Metodo no permitido.' }, event);
  }

  if (!isOriginAllowed(event)) {
    return response(403, { ok: false, message: 'Origen no permitido.' }, event);
  }

  const ip = getClientIp(event);
  const rateLimit = checkRateLimit(ip);
  if (rateLimit.blocked) {
    return response(
      429,
      { ok: false, message: 'Demasiadas solicitudes. Intenta nuevamente mas tarde.' },
      event,
      { 'Retry-After': String(rateLimit.retryAfter || 60) },
    );
  }

  let parsed;
  try {
    parsed = parsePayload(event);
  } catch (error) {
    return response(400, { ok: false, message: error.message || 'Payload invalido.' }, event);
  }

  const fields = parsed.fields || {};
  const antiBot = validateAntiBot(fields);
  if (!antiBot.ok) {
    return response(antiBot.status, { ok: false, message: antiBot.message }, event);
  }

  const fullName = sanitizeText(fields.fullName, { max: 120 });
  const email = sanitizeText(fields.email, { max: 320 }).toLowerCase();

  if (fullName.length < 2) {
    return response(400, { ok: false, message: 'El nombre completo es obligatorio.' }, event);
  }

  if (!isValidEmail(email)) {
    return response(400, { ok: false, message: 'El email no es valido.' }, event);
  }

  let subject;
  let html;
  const attachments = [];

  if (type === 'quote') {
    const message = sanitizeText(fields.message, { max: 2000 });
    if (message.length < 10) {
      return response(400, { ok: false, message: 'La consulta es obligatoria y debe tener al menos 10 caracteres.' }, event);
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
    const phone = sanitizeText(fields.phone, { max: 30 });
    if (phone.length < 6) {
      return response(400, { ok: false, message: 'El telefono es obligatorio.' }, event);
    }

    if (parsed.file) {
      const cvCheck = validateCvFile(parsed.file);
      if (!cvCheck.ok) {
        return response(400, { ok: false, message: cvCheck.message }, event);
      }

      attachments.push({
        filename: parsed.file.filename,
        content: parsed.file.buffer,
        contentType: parsed.file.contentType,
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
    return response(404, { ok: false, message: 'Tipo de formulario no soportado.' }, event);
  }

  const to = resolveMailTo();
  const from = sanitizeText(process.env.MAIL_FROM || process.env.SMTP_USER, { max: 255 });

  if (!to) {
    return response(500, { ok: false, message: 'No se configuro MAIL_TO o MAIL_TO_ENCRYPTED.' }, event);
  }

  if (!from) {
    return response(500, { ok: false, message: 'No se configuro MAIL_FROM o SMTP_USER.' }, event);
  }

  const transporter = buildTransporter();
  if (!transporter) {
    return response(500, { ok: false, message: 'Faltan credenciales SMTP validas.' }, event);
  }

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject,
      html,
      attachments,
    });

    return response(200, { ok: true, message: 'Formulario enviado correctamente.' }, event);
  } catch {
    return response(500, { ok: false, message: 'Error enviando el correo.' }, event);
  }
}

module.exports = {
  handleFormSubmission,
};
