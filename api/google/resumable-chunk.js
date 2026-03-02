export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const uploadUrl = String(req.body?.uploadUrl || '').trim();
    const base64Data = String(req.body?.base64Data || '');
    const start = Number(req.body?.start);
    const end = Number(req.body?.end);
    const total = Number(req.body?.total);

    if (!uploadUrl || !base64Data || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(total)) {
      return res.status(400).json({ error: 'uploadUrl, base64Data, start, end, total are required' });
    }
    if (start < 0 || end < start || total <= 0) {
      return res.status(400).json({ error: 'Invalid byte range' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const expectedBytes = end - start + 1;
    if (buffer.length !== expectedBytes) {
      return res.status(400).json({ error: 'Chunk size mismatch' });
    }

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(buffer.length),
        'Content-Range': `bytes ${start}-${end}/${total}`
      },
      body: buffer
    });

    if (response.status === 308) {
      const range = response.headers.get('Range') || '';
      let nextStart = end + 1;
      const match = range.match(/bytes=0-(\d+)/i);
      if (match?.[1]) {
        nextStart = Number(match[1]) + 1;
      }
      return res.status(200).json({
        ok: true,
        resumable: true,
        nextStart
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return res.status(response.status || 500).json({
        error: 'Resumable chunk upload failed',
        detail
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!payload?.id) {
      return res.status(500).json({ error: 'Upload completed but missing file id' });
    }

    return res.status(200).json({
      ok: true,
      resumable: false,
      fileId: payload.id
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Chunk upload error'
    });
  }
}
