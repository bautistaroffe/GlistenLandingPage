require('dotenv').config();

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
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

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function requireField(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function decryptMailTo(encryptedValue, key) {
  const payload = String(encryptedValue || '').trim();
  const secret = String(key || '');
  if (!payload || !secret) return '';

  const keyBuffer = crypto.createHash('sha256').update(secret).digest();
  const split = payload.split(':');

  if (split.length === 3) {
    const [ivPart, tagPart, dataPart] = split;
    const iv = Buffer.from(ivPart, /^[0-9a-f]+$/i.test(ivPart) ? 'hex' : 'base64');
    const tag = Buffer.from(tagPart, /^[0-9a-f]+$/i.test(tagPart) ? 'hex' : 'base64');
    const encrypted = Buffer.from(dataPart, /^[0-9a-f]+$/i.test(dataPart) ? 'hex' : 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8').trim();
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
  const plain = String(process.env.MAIL_TO || '').trim();
  if (plain) return plain;

  try {
    return decryptMailTo(process.env.MAIL_TO_ENCRYPTED, process.env.MAIL_TO_KEY);
  } catch {
    return '';
  }
}

app.post('/api/forms/:type', upload.single('cv'), async (req, res) => {
  const { type } = req.params;
  const toEmail = resolveMailTo();

  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim();

  if (!requireField(fullName)) {
    return res.status(400).json({ ok: false, message: 'El nombre completo es obligatorio.' });
  }

  if (!validEmail(email)) {
    return res.status(400).json({ ok: false, message: 'El email no es valido.' });
  }

  let subject = '';
  let html = '';
  const attachments = [];

  if (type === 'job') {
    const phone = String(req.body.phone || '').trim();
    if (!requireField(phone)) {
      return res.status(400).json({ ok: false, message: 'El telefono es obligatorio.' });
    }

    subject = `Nueva postulacion - ${fullName}`;
    html = `
      <h2>Nueva postulacion</h2>
      <p><strong>Nombre:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Telefono:</strong> ${phone}</p>
    `;

    if (req.file) {
      attachments.push({
        filename: req.file.originalname,
        content: req.file.buffer,
        contentType: req.file.mimetype,
      });
    }
  } else if (type === 'quote') {
    const message = String(req.body.message || '').trim();
    if (!requireField(message)) {
      return res.status(400).json({ ok: false, message: 'La consulta es obligatoria.' });
    }

    subject = `Nueva solicitud de presupuesto - ${fullName}`;
    html = `
      <h2>Nueva solicitud de presupuesto</h2>
      <p><strong>Nombre:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Consulta:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>
    `;
  } else {
    return res.status(404).json({ ok: false, message: 'Tipo de formulario no soportado.' });
  }

  try {
    if (!toEmail) {
      return res.status(500).json({
        ok: false,
        message: 'No se configuro MAIL_TO o MAIL_TO_ENCRYPTED en el servidor.',
      });
    }

    const transporter = buildTransporter();

    if (!transporter) {
      return res.status(500).json({
        ok: false,
        message: 'Faltan credenciales SMTP. Configura SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.',
      });
    }

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: toEmail,
      replyTo: email,
      subject,
      html,
      attachments,
    });

    return res.json({ ok: true, message: 'Formulario enviado correctamente.' });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error enviando el correo. Revisa la configuracion SMTP.',
      detail: error.message,
    });
  }
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
