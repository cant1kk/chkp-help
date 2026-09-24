#!/usr/bin/env node
/**
 * add-user.js — Добавить или обновить пользователя
 *
 * Использование:
 *   node add-user.js <ID> <SUBSCRIPTION_LINK>
 *
 * Пример:
 *   node add-user.js 5 "vless://abc123@sub.ftp.sh:443?security=tls#user5"
 */

const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');

function encodeLink(link) {
  return Buffer.from(link, 'utf8').toString('base64');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Использование: node add-user.js <ID> <LINK>');
    console.error('Пример: node add-user.js 5 "vless://abc@sub.ftp.sh?security=tls#user5"');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  const link = args[1];

  if (isNaN(id) || id < 1) {
    console.error('ID должен быть положительным числом');
    process.exit(1);
  }

  if (!link) {
    console.error('Ссылка не указана');
    process.exit(1);
  }

  let users = {};
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      users = raw.users || {};
      console.log(`📄 Загружено пользователей: ${Object.keys(users).length}`);
    } catch (e) {
      console.error('Ошибка чтения users.json:', e.message);
      process.exit(1);
    }
  }

  users[id] = encodeLink(link);
  console.log(`➕ ID ${id}: ${link.slice(0, 50)}...`);

  const output = {
    _comment: 'Формат: {<ID>: "<base64-ссылка>"}',
    users,
  };
  fs.writeFileSync(USERS_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✅ Сохранено в ${USERS_FILE}`);
}

main();
