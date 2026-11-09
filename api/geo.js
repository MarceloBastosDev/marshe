// Região aproximada do visitante (cidade/estado/país), a partir dos cabeçalhos que a Vercel
// já calcula pelo endereço de internet. Não guarda nem devolve o IP.
module.exports = (req, res) => {
  const h = req.headers;
  const dec = (v) => { try { return v ? decodeURIComponent(String(v)) : null; } catch { return String(v); } };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify({
    cidade: dec(h["x-vercel-ip-city"]),
    estado: h["x-vercel-ip-country-region"] || null,
    pais: h["x-vercel-ip-country"] || null
  }));
};
