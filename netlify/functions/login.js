
const crypto = require('crypto');


function generateToken(username) {
  const secretKey = process.env.AUTH_SECRET;
  if (!secretKey) return null;
  const expiresAt = Date.now() + 3600 * 1000;
  const payload = JSON.stringify({ user: username, exp: expiresAt });
  const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
  const token = Buffer.from(payload).toString('base64') + '.' + signature;
  return { token, expiresAt };
}


exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
  }

  if (!process.env.AUTH_SECRET) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'AUTH_SECRET belum dikonfigurasi di Netlify Dashboard.' }) };
  }

  try {
    const { username, password } = JSON.parse(event.body || '{}');

    if (!username || !password) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'Username dan Password wajib diisi.' }) };
    }

    
    let validUser = null;
    for (let i = 1; i <= 10; i++) {
      const u = process.env[`USER${i}_NAME`];
      const p = process.env[`USER${i}_PASS`];
      if (u && p && username.trim() === u.trim() && password === p) {
        validUser = u.trim();
        break;
      }
    }

    if (validUser) {
      const { token, expiresAt } = generateToken(validUser);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, token, user: validUser, expiresAt, message: 'Login berhasil.' })
      };
    }

    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'Username atau Password salah.' }) };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'Kesalahan server login.' }) };
  }
};
