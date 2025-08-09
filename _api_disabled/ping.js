// CommonJS - safest with Vercel on Windows
module.exports = (req, res) => {
  res.status(200).json({ ok: true, t: Date.now() });
};
