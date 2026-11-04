const Search = require("../models/vendorSearchModel");

async function search(req, res) {
  const vendorId = req.params.id;
  const q = (req.query.q || "").trim();

  if (q.length < 2) return res.json({ results: [] });

  try {
    const results = await Search.search(vendorId, q);
    res.json({ results });
  } catch (err) {
    console.error("Error running vendor search:", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = { search };
