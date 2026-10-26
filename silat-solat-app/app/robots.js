export default function robots() {
  const open = process.env.ALLOW_INDEXING === "1";
  return { rules: open ? { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/instructor"] } : { userAgent: "*", disallow: "/" } };
}
