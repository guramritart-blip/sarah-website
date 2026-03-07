module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var password = req.body.password;
  var slug = req.body.slug;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  var GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  var REPO = process.env.GITHUB_REPO || 'guramritart-blip/sarah-website';
  var BRANCH = 'main';

  var ghHeaders = {
    Authorization: 'token ' + GITHUB_TOKEN,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json'
  };

  try {
    // Get the blog post file to confirm it exists
    var fileRes = await fetch('https://api.github.com/repos/' + REPO + '/contents/blog/' + slug + '.html?ref=' + BRANCH, { headers: ghHeaders });
    if (!fileRes.ok) return res.status(404).json({ error: 'Post not found' });

    // Get current blog.html
    var blogRes = await fetch('https://api.github.com/repos/' + REPO + '/contents/blog.html?ref=' + BRANCH, { headers: ghHeaders });
    if (!blogRes.ok) throw new Error('Failed to fetch blog.html');
    var blogData = await blogRes.json();
    var blogHtml = Buffer.from(blogData.content, 'base64').toString('utf-8');

    // Remove the card for this post from blog.html
    // Match the full <a> card block for this slug
    var cardRegex = new RegExp('\\s*<a href="blog/' + slug + '\\.html"[\\s\\S]*?<\\/a>', 'g');
    var updatedBlogHtml = blogHtml.replace(cardRegex, '');

    // Atomic commit: delete blog post file + update blog.html
    // 1. Get latest commit
    var refRes = await fetch('https://api.github.com/repos/' + REPO + '/git/refs/heads/' + BRANCH, { headers: ghHeaders });
    if (!refRes.ok) throw new Error('Failed to get ref');
    var refData = await refRes.json();
    var latestSha = refData.object.sha;

    // 2. Get base tree
    var commitRes = await fetch('https://api.github.com/repos/' + REPO + '/git/commits/' + latestSha, { headers: ghHeaders });
    if (!commitRes.ok) throw new Error('Failed to get commit');
    var commitData = await commitRes.json();

    // 3. Create new tree — delete file by setting sha to null, update blog.html
    var treeRes = await fetch('https://api.github.com/repos/' + REPO + '/git/trees', {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        base_tree: commitData.tree.sha,
        tree: [
          { path: 'blog/' + slug + '.html', mode: '100644', type: 'blob', sha: null },
          { path: 'blog.html', mode: '100644', type: 'blob', content: updatedBlogHtml }
        ]
      })
    });
    if (!treeRes.ok) throw new Error('Failed to create tree');
    var treeData = await treeRes.json();

    // 4. Create commit
    var newCommitRes = await fetch('https://api.github.com/repos/' + REPO + '/git/commits', {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        message: 'Delete blog post: ' + slug,
        tree: treeData.sha,
        parents: [latestSha]
      })
    });
    if (!newCommitRes.ok) throw new Error('Failed to create commit');
    var newCommitData = await newCommitRes.json();

    // 5. Update ref
    var updateRes = await fetch('https://api.github.com/repos/' + REPO + '/git/refs/heads/' + BRANCH, {
      method: 'PATCH',
      headers: ghHeaders,
      body: JSON.stringify({ sha: newCommitData.sha })
    });
    if (!updateRes.ok) throw new Error('Failed to update branch');

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete: ' + error.message });
  }
};
