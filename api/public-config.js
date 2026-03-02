export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const guestUploadMaxMb = Number(process.env.GUEST_UPLOAD_MAX_MB || '25');
  const guestUploadTransportMaxMb = Number(process.env.GUEST_UPLOAD_TRANSPORT_MAX_MB || '4');
  return res.status(200).json({
    guestUploadMaxMb: Number.isFinite(guestUploadMaxMb) && guestUploadMaxMb > 0 ? guestUploadMaxMb : 25,
    guestUploadTransportMaxMb:
      Number.isFinite(guestUploadTransportMaxMb) && guestUploadTransportMaxMb > 0 ? guestUploadTransportMaxMb : 4
  });
}
