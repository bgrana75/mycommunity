import './siteFooter.css';

/**
 * Site-wide "Powered by Hive" backlink for hive.io SEO.
 * Kept as a Server Component so the dofollow link is in the initial HTML.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <a href="https://hive.io" target="_blank" rel="noopener">
        Powered by Hive
      </a>
    </footer>
  );
}
