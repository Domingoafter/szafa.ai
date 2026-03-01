require("dotenv").config();
const { pool } = require("./db");

async function init() {
  await pool.query(`
    create table if not exists users (
      id text primary key,
      email text,
      created_at timestamptz default now()
    );

    create table if not exists garments (
      id bigserial primary key,
      user_id text not null references users(id) on delete cascade,
      name text not null,
      category text,
      color text,
      season text,
      image_url text,
      created_at timestamptz default now()
    );
  `);

  console.log("DB initialized");
  process.exit(0);
}

init().catch((e) => {
  console.error(e);
  process.exit(1);
});