
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_KEY;
  const hasAuth = !!process.env.AUTH_SECRET;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      status: (hasUrl && hasKey) ? 'ready' : 'incomplete',
      has_supabase_url: hasUrl,
      has_supabase_key: hasKey,
      has_auth_secret: hasAuth,
      timestamp: new Date().toISOString()
    })
  };
};
