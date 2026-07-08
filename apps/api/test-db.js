require('dotenv/config');
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      SELECT 
        p.id,
        p.title,
        p.slug,
        p.cover_image AS "coverImage",
        MIN(v.price) AS "minPrice"
      FROM products p
      INNER JOIN variants v ON v.product_id = p.id
      INNER JOIN inventory i ON i.product_variant_id = v.id
      WHERE p.status = 'ACTIVE'
        AND ($1::text IS NULL OR i.location_id = $1)
        AND i.quantity > 0
      GROUP BY p.id, p.title, p.slug, p.cover_image, p.created_at
      ORDER BY p.created_at DESC
      LIMIT $2
    `, [null, 24]);
    console.log("Success");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
