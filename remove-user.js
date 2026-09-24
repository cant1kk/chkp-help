#!/usr/bin/env node
/**
 * remove-user.js — Удалить пользователя
 *
 * Использование:
 *   node remove-user.js <ID>
 */

const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Использование: node remove-user.js <ID>');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    console.error('ID должен быть числом');
    process.exit(1);
  }

  if (!fs.existsSync(USERS_FILE)) {
    console.error('users.json не найден');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const users = raw.users || {};

  if (!users[id]) {
    console.error(`Пользователь #${id} не найден`);
    process.exit(1);
  }

  const link = Buffer.from(users[id], 'base64').toString('utf8');
  console.log(`🗑 Удаляем #${id}: ${link.slice(0, 40)}...`);
  delete users[id];

  raw.users = users;
  fs.writeFileSync(USERS_FILE, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`✅ Удалён. Осталось: ${Object.keys(users).length}`);
}

main();
