const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});

async function run() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'emergency_sos'
        });

        const [tables] = await conn.query('SHOW TABLES');
        if (tables.length === 0) {
            console.log('No tables found in database.');
            conn.end();
            return;
        }

        console.log('--- Database Tables ---');
        for (let row of tables) {
            const tableName = Object.values(row)[0];
            const [data] = await conn.query(`SELECT * FROM ${tableName} LIMIT 5`);
            console.log(`\nTable: ${tableName} (showing up to 5 rows)`);
            console.table(data);
        }
        conn.end();
    } catch(e) {
        console.error('Error:', e.message);
    }
}
run();
