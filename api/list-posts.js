module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.body.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  var GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  var REPO = process.env.GITHUB_REPO || 'guramritart-blip/sarah-website';

  var ghHeaders = {
    Authorization: 'token ' + GITHUB_TOKEN,
    Accept: 'application/vnd.github.v3+json'
  };

  try {
    var dirRes = await fetch('https://api.github.com/repos/' + REPO + '/contents/blog?ref=main', { headers: ghHeaders });
    if (!dirRes.ok) throw new Error('Failed to list blog directory');
    var files = await dirRes.json();

    var posts = files
      .filter(function(f) { return f.name.endsWith('.html'); })
      .map(function(f) { return { name: f.name, slug: f.name.replace('.html', '') }; });

    return res.status(200).json({ posts: posts });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to list posts: ' + error.message });
  }
};
