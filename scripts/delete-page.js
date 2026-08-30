#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function splitWords(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toPascalCase(str) {
  const words = splitWords(str);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str) {
  const words = splitWords(str);
  return words.map((w) => w.toLowerCase()).join('-');
}

function removeFromListed(content, key) {
  const regex = new RegExp(`\\n?\\s*${key}:\\s*\\{[\\s\\S]*?\\},?`, 'g');
  const updated = content.replace(regex, '');
  // Clean up any trailing comma right before closing brace
  return updated.replace(/,(\s*\})/g, '$1');
}

function removeFromRouter(content, importName, kebabName) {
  // Remove import statement
  const importRegex = new RegExp(`\\n?import\\s+${importName}\\s+from\\s+["']\\.\\./pages/${kebabName}["'];?`, 'g');
  let updated = content.replace(importRegex, '');

  // Remove route object
  const routeRegex = new RegExp(`\\n?\\s*\\{\\s*path:\\s*["'][^"']*?${kebabName}[^"']*?["'],\\s*element:\\s*<${importName}\\s*/>\\s*\\},?`, 'g');
  updated = updated.replace(routeRegex, '');

  // Clean up any trailing comma right before closing bracket
  return updated.replace(/,(\s*\])/g, '$1');
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  let rawName = args.join(' ').trim();

  if (!rawName) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log(`\n${colors.bold}${colors.red}🗑️  React Boilerplate Page Remover 🗑️${colors.reset}\n`);
      const answer = await rl.question(`${colors.bold}Enter page name to delete (e.g. About, User Profile): ${colors.reset}`);
      rawName = answer.trim();
    } finally {
      rl.close();
    }
  }

  if (!rawName) {
    console.error(`${colors.red}✖ Error: Page name cannot be empty.${colors.reset}`);
    process.exit(1);
  }

  const pascalName = toPascalCase(rawName);
  const camelName = toCamelCase(rawName);
  const kebabName = toKebabCase(rawName);
  const fileName = `${kebabName}.tsx`;

  const pagesDir = path.join(rootDir, 'src', 'pages');
  const pageFilePath = path.join(pagesDir, fileName);
  const listedFilePath = path.join(rootDir, 'src', 'constants', 'listed.tsx');
  const routerFilePath = path.join(rootDir, 'src', 'constants', 'router.tsx');

  if (fs.existsSync(pageFilePath)) {
    fs.unlinkSync(pageFilePath);
    console.log(`${colors.green}✔ Deleted file:${colors.reset} src/pages/${fileName}`);
  } else {
    console.log(`${colors.yellow}⚠ File not found (skipping delete):${colors.reset} src/pages/${fileName}`);
  }

  if (fs.existsSync(listedFilePath)) {
    const listedContent = fs.readFileSync(listedFilePath, 'utf-8');
    const updated = removeFromListed(listedContent, camelName);
    fs.writeFileSync(listedFilePath, updated, 'utf-8');
    console.log(`${colors.green}✔ Removed entry from:${colors.reset} src/constants/listed.tsx`);
  }

  if (fs.existsSync(routerFilePath)) {
    const routerContent = fs.readFileSync(routerFilePath, 'utf-8');
    const updated = removeFromRouter(routerContent, pascalName, kebabName);
    fs.writeFileSync(routerFilePath, updated, 'utf-8');
    console.log(`${colors.green}✔ Removed route and import from:${colors.reset} src/constants/router.tsx`);
  }

  console.log(`\n${colors.bold}${colors.green}✔ Successfully removed page "${rawName}"!${colors.reset}\n`);
}

main().catch((err) => {
  console.error(`${colors.red}Unexpected error: ${err.message}${colors.reset}`);
  process.exit(1);
});
