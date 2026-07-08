require('dotenv/config');
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      SELECT 
        v.id,
        COALESCE(SUM(CASE WHEN $2::text IS NULL OR i.location_id = $2 THEN i.quantity ELSE 0 END), 0)::int AS "stockTotal"
      FROM variants v
      LEFT JOIN inventory i ON i.product_variant_id = v.id
      WHERE v.product_id = $1
      GROUP BY v.id, v.created_at
      ORDER BY v.created_at ASC
    `, ['d3b07384-d113-4ec2-a5d6-c8402b89f819', null]);
    console.log("Success");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
