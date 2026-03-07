module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var password = req.body.password;
  var title = req.body.title;
  var slug = req.body.slug;
  var date = req.body.date;
  var metaDescription = req.body.metaDescription;
  var excerpt = req.body.excerpt;
  var content = req.body.content;
  var featured = req.body.featured;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!title || !slug || !date || !excerpt || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Slug can only contain lowercase letters, numbers, and hyphens' });
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
    // Check if blog post already exists
    var existsRes = await fetch(
      'https://api.github.com/repos/' + REPO + '/contents/blog/' + slug + '.html?ref=' + BRANCH,
      { headers: ghHeaders }
    );
    if (existsRes.ok) {
      return res.status(409).json({ error: 'A blog post with slug "' + slug + '" already exists. Choose a different slug.' });
    }

    // Generate blog post HTML page
    var postHtml = generatePostHtml({ title: title, date: date, metaDescription: metaDescription || excerpt, excerpt: excerpt, content: content });

    // Generate blog card HTML for listing page
    var cardHtml = generateCardHtml({ slug: slug, title: title, date: date, excerpt: excerpt, featured: featured });

    // Fetch current blog.html from GitHub
    var blogRes = await fetch('https://api.github.com/repos/' + REPO + '/contents/blog.html?ref=' + BRANCH, { headers: ghHeaders });
    if (!blogRes.ok) throw new Error('Failed to fetch blog.html from GitHub');
    var blogData = await blogRes.json();
    var currentBlogHtml = Buffer.from(blogData.content, 'base64').toString('utf-8');

    // Insert new card after marker
    var marker = '<!-- NEW_POSTS_HERE -->';
    if (!currentBlogHtml.includes(marker)) {
      return res.status(500).json({ error: 'Blog listing marker not found in blog.html.' });
    }
    var updatedBlogHtml = currentBlogHtml.replace(marker, marker + '\n\n' + cardHtml);

    // Atomic multi-file commit via Git Data API
    var refRes = await fetch('https://api.github.com/repos/' + REPO + '/git/refs/heads/' + BRANCH, { headers: ghHeaders });
    if (!refRes.ok) throw new Error('Failed to get branch ref');
    var refData = await refRes.json();
    var latestSha = refData.object.sha;

    var commitRes = await fetch('https://api.github.com/repos/' + REPO + '/git/commits/' + latestSha, { headers: ghHeaders });
    if (!commitRes.ok) throw new Error('Failed to get commit data');
    var commitData = await commitRes.json();

    var treeRes = await fetch('https://api.github.com/repos/' + REPO + '/git/trees', {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        base_tree: commitData.tree.sha,
        tree: [
          { path: 'blog/' + slug + '.html', mode: '100644', type: 'blob', content: postHtml },
          { path: 'blog.html', mode: '100644', type: 'blob', content: updatedBlogHtml }
        ]
      })
    });
    if (!treeRes.ok) throw new Error('Failed to create tree');
    var treeData = await treeRes.json();

    var newCommitRes = await fetch('https://api.github.com/repos/' + REPO + '/git/commits', {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        message: 'Add blog post: ' + title,
        tree: treeData.sha,
        parents: [latestSha]
      })
    });
    if (!newCommitRes.ok) throw new Error('Failed to create commit');
    var newCommitData = await newCommitRes.json();

    var updateRes = await fetch('https://api.github.com/repos/' + REPO + '/git/refs/heads/' + BRANCH, {
      method: 'PATCH',
      headers: ghHeaders,
      body: JSON.stringify({ sha: newCommitData.sha })
    });
    if (!updateRes.ok) throw new Error('Failed to update branch');

    return res.status(200).json({ success: true, url: '/blog/' + slug + '.html' });

  } catch (error) {
    console.error('Publish error:', error);
    return res.status(500).json({ error: 'Failed to publish: ' + error.message });
  }
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generatePostHtml(opts) {
  var t = escapeHtml(opts.title);
  var d = escapeHtml(opts.date);
  var m = escapeHtml(opts.metaDescription);
  var e = escapeHtml(opts.excerpt);
  var year = new Date().getFullYear();

  return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'    <title>' + t + ' | Sarah Eileen Mehta</title>\n' +
'    <meta name="description" content="' + m + '">\n' +
'    <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&display=swap" rel="stylesheet">\n' +
'    <link rel="stylesheet" href="../styles.css">\n' +
'    <link rel="stylesheet" href="../blog.css">\n' +
'</head>\n' +
'<body>\n' +
'\n' +
'<nav class="nav nav--scrolled" id="nav">\n' +
'    <div class="nav__container">\n' +
'        <a href="../index.html" class="nav__logo">S<span class="nav__logo-accent">M</span></a>\n' +
'        <button class="nav__toggle" id="navToggle" aria-label="Toggle navigation">\n' +
'            <span></span><span></span><span></span>\n' +
'        </button>\n' +
'        <ul class="nav__links" id="navLinks">\n' +
'            <li><a href="../index.html#about">About</a></li>\n' +
'            <li><a href="../index.html#experience">Experience</a></li>\n' +
'            <li><a href="../blog.html" class="nav__links--active">Insights</a></li>\n' +
'            <li><a href="../contact.html" class="nav__cta">Let\'s Connect</a></li>\n' +
'        </ul>\n' +
'    </div>\n' +
'</nav>\n' +
'\n' +
'<header class="article-header">\n' +
'    <div class="container">\n' +
'        <span class="article-header__date">' + d + '</span>\n' +
'        <h1 class="article-header__title">' + t + '</h1>\n' +
'        <p class="article-header__subtitle">' + e + '</p>\n' +
'    </div>\n' +
'</header>\n' +
'\n' +
'<article class="article">\n' +
'    <div class="container article__container">\n' +
'        <a href="../blog.html" class="article__back">Back to Insights</a>\n' +
'\n' +
opts.content + '\n' +
'\n' +
'        <div class="article__cta">\n' +
'            <p>Interested in learning more about this topic?</p>\n' +
'            <a href="../contact.html" class="btn btn--primary">Let\'s Connect</a>\n' +
'        </div>\n' +
'    </div>\n' +
'</article>\n' +
'\n' +
'<footer class="footer">\n' +
'    <div class="container">\n' +
'        <div class="footer__top">\n' +
'            <div class="footer__brand">\n' +
'                <span class="footer__name">Sarah Eileen Mehta</span>\n' +
'                <p class="footer__tagline">Strategic Operations & Enterprise Risk</p>\n' +
'            </div>\n' +
'            <div class="footer__nav">\n' +
'                <span class="footer__nav-title">Quick Links</span>\n' +
'                <a href="../index.html#about">About</a>\n' +
'                <a href="../index.html#experience">Experience</a>\n' +
'                <a href="../index.html#expertise">Expertise</a>\n' +
'                <a href="../contact.html">Contact</a>\n' +
'            </div>\n' +
'            <div class="footer__nav">\n' +
'                <span class="footer__nav-title">Insights</span>\n' +
'                <a href="../blog.html">All Articles</a>\n' +
'            </div>\n' +
'            <div class="footer__nav">\n' +
'                <span class="footer__nav-title">Connect</span>\n' +
'                <a href="mailto:sarah.eileen.mehta@gmail.com">Email</a>\n' +
'                <a href="https://linkedin.com/in/sarah-eileen-mehta" target="_blank" rel="noopener noreferrer">LinkedIn</a>\n' +
'            </div>\n' +
'        </div>\n' +
'        <div class="footer__bottom">\n' +
'            <span class="footer__copy">&copy; ' + year + ' Sarah Eileen Mehta. All rights reserved.</span>\n' +
'        </div>\n' +
'    </div>\n' +
'</footer>\n' +
'\n' +
'<script>\n' +
'var toggle = document.getElementById(\'navToggle\');\n' +
'var links = document.getElementById(\'navLinks\');\n' +
'toggle.addEventListener(\'click\', function() {\n' +
'    links.classList.toggle(\'nav__links--open\');\n' +
'    toggle.classList.toggle(\'nav__toggle--active\');\n' +
'});\n' +
'\n' +
'var observer = new IntersectionObserver(function(entries) {\n' +
'    entries.forEach(function(entry) {\n' +
'        if (entry.isIntersecting) {\n' +
'            entry.target.classList.add(\'animated\');\n' +
'            observer.unobserve(entry.target);\n' +
'        }\n' +
'    });\n' +
'}, { threshold: 0.3 });\n' +
'document.querySelectorAll(\'.stat-ring, .bar-chart\').forEach(function(el) { observer.observe(el); });\n' +
'</script>\n' +
'\n' +
'</body>\n' +
'</html>';
}

function generateCardHtml(opts) {
  var t = escapeHtml(opts.title);
  var d = escapeHtml(opts.date);
  var e = escapeHtml(opts.excerpt);

  if (opts.featured) {
    return '            <a href="blog/' + opts.slug + '.html" class="blog-card blog-card--featured">\n' +
'                <div class="blog-card__image">\n' +
'                    <span class="blog-card__tag">Featured</span>\n' +
'                </div>\n' +
'                <div class="blog-card__body">\n' +
'                    <span class="blog-card__date">' + d + '</span>\n' +
'                    <h2 class="blog-card__title">' + t + '</h2>\n' +
'                    <p class="blog-card__excerpt">' + e + '</p>\n' +
'                    <span class="blog-card__link">Read Article</span>\n' +
'                </div>\n' +
'            </a>';
  }

  return '            <a href="blog/' + opts.slug + '.html" class="blog-card">\n' +
'                <div class="blog-card__body">\n' +
'                    <span class="blog-card__date">' + d + '</span>\n' +
'                    <h2 class="blog-card__title">' + t + '</h2>\n' +
'                    <p class="blog-card__excerpt">' + e + '</p>\n' +
'                    <span class="blog-card__link">Read Article</span>\n' +
'                </div>\n' +
'            </a>';
}
