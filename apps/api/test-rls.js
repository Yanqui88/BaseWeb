const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function test() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT current_user, (SELECT count(*) FROM products) as c');
    console.log('User:', res.rows[0].current_user, 'Products without context:', res.rows[0].c);
  } finally {
    client.release();
    pool.end();
  }
}
test().catch(console.error);
