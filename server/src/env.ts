import 'dotenv/config';

export const env = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  DB_FILE: process.env.DB_FILE || './data.sqlite',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me'
};

