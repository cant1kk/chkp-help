#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Использование: node add-news.js "<Заголовок>" "<Текст новости>" [Тег]');
  console.log('Пример: node add-news.js "Новый сервер" "Добавили локацию в Нидерландах." "Серверы"');
  process.exit(1);
}

const title = args[0].trim();
const text = args[1].trim();
const tag = (args[2] || 'Обновление').trim();

const newsPath = path.join(__dirname, 'news.json');
let news = [];
if (fs.existsSync(newsPath)) {
  try {
    news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  } catch (e) {
    news = [];
  }
}
if (!Array.isArray(news)) news = [];

const now = new Date();
const dateStr = now.toISOString().split('T')[0];

const newEntry = {
  id: Date.now().toString(),
  date: dateStr,
  tag,
  title,
  text
};

news.unshift(newEntry);
fs.writeFileSync(newsPath, JSON.stringify(news, null, 2) + '\n', 'utf8');

console.log(`✓ Новость добавлена: "${title}" (${dateStr})`);

try {
  console.log('Коммитим и пушим в репозиторий...');
  execSync('git add news.json', { cwd: __dirname, stdio: 'inherit' });
  execSync(`git commit -m "news: ${title.replace(/"/g, '\\"')}"`, { cwd: __dirname, stdio: 'inherit' });
  execSync('git push origin main', { cwd: __dirname, stdio: 'inherit' });
  console.log('✓ Успешно задеплоено на GitHub Pages!');
} catch (e) {
  console.error('Ошибка при git push:', e.message);
}
