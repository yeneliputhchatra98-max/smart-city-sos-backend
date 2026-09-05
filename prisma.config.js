require('dotenv').config();
const { defineConfig } = require('@prisma/config');

module.exports = defineConfig({
  earlyAccess: true,
  datasourceUrl: process.env.DATABASE_URL,
});
