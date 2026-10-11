import { pool } from '../src/db/client.js';
import { migrateDatabase } from '../src/db/migrate.js';

await migrateDatabase();
console.log('Migrations applied.');
await pool.end();
