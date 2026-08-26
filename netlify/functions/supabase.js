
const https = require('https');
const http = require('http');

exports.handler = async function (event) {
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'SUPABASE_URL atau SUPABASE_KEY belum dikonfigurasi di Environment Variables.' })
    };
  }

  const queryParams = Object.assign({}, event.queryStringParameters || {});
  const table = queryParams.table;
  if (!table) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Parameter query ?table=... wajib disertakan.' })
    };
  }
  delete queryParams.table;

  
  if (!/^[a-zA-Z0-9_-]+$/.test(table)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Nama tabel tidak valid.' })
    };
  }

  
  const queryStr = Object.keys(queryParams).map(k => `${encodeURIComponent(k)}=${queryParams[k]}`).join('&');
  const targetUrl = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${table}${queryStr ? '?' + queryStr : ''}`;

  try {
    const data = await new Promise((resolve, reject) => {
      const urlObj = new URL(targetUrl);
      const transport = urlObj.protocol === 'https:' ? https : http;
      const req = transport.request(urlObj, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body });
          } else {
            reject(new Error(`Supabase REST API returned status ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Supabase request timeout after 15s'));
      });
      req.end();
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Access-Control-Allow-Origin': '*'
      },
      body: data.body
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Gagal mengambil data dari Supabase.', details: err.message })
    };
  }
};
