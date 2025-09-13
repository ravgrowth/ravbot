/* eslint-env node */
export default function ping(req, res) {
  res.status(200).json({ ok: true, t: Date.now() });
}
