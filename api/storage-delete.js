export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Missing server env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!userResp.ok) {
      const reason = await userResp.text();
      return res.status(401).json({ error: `Invalid auth token: ${reason}` });
    }

    const body = req.body || {};
    const bucket = String(body.bucket || '').trim();
    const rawPaths = Array.isArray(body.paths) ? body.paths : [];
    const paths = rawPaths
      .map((p) => String(p || '').trim().replace(/^\/+/, ''))
      .filter((p) => p && !p.startsWith('http://') && !p.startsWith('https://'));

    if (!bucket || !paths.length) {
      return res.status(400).json({ error: 'bucket and paths[] are required' });
    }

    const deleteResp = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ prefixes: paths })
    });

    const payload = await deleteResp.json().catch(() => ({}));
    if (!deleteResp.ok) {
      return res.status(deleteResp.status).json({
        error: payload?.error || payload?.message || 'Storage delete failed',
        detail: payload
      });
    }

    return res.status(200).json({
      ok: true,
      bucket,
      deleted: paths,
      result: payload
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Unhandled storage delete error',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
