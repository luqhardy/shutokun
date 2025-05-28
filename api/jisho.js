export default async function handler(req, res) {
  const { keyword } = req.query;
  if (!keyword) {
    res.status(400).json({ error: 'Missing keyword' });
    return;
  }
  const apiUrl = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`;
  try {
    const fetchRes = await fetch(apiUrl);
    const data = await fetchRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Proxy error' });
  }
}