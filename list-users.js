#!/usr/bin/env node
/**
 * list-users.js — Показать список пользователей (раскодированные ссылки)
 *
 * Использование:
 *   node list-users.js
 */

const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');

function main() {
  if (!fs.existsSync(USERS_FILE)) {
    console.error('users.json не найден');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const users = raw.users || {};
  const ids = Object.keys(users).map(Number).sort((a, b) => a - b);

  if (ids.length === 0) {
    console.log('Нет пользователей');
    return;
  }

  console.log(`Пользователей: ${ids.length}\n`);
  for (const id of ids) {
    const link = Buffer.from(users[id], 'base64').toString('utf8');
    console.log(`#${id}  ${link.slice(0, 60)}${link.length > 60 ? '...' : ''}`);
  }
}

main();
