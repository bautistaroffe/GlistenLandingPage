const crypto = require('crypto');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const mailTo = String(process.env.MAIL_TO || '').trim();
const key = String(process.env.MAIL_TO_KEY || '').trim();

if (!mailTo) fail('Falta MAIL_TO en el entorno.');
if (!key) fail('Falta MAIL_TO_KEY en el entorno.');

const iv = crypto.randomBytes(12);
const keyBuffer = crypto.createHash('sha256').update(key).digest();
const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
const encrypted = Buffer.concat([cipher.update(mailTo, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

const payload = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;

console.log('MAIL_TO_ENCRYPTED=' + payload);
