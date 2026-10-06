/** Absolute site origin for metadata, robots and the sitemap. */
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(configured);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
