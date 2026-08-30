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
  blue: '\x1b[34m',
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

function toTitleCase(str) {
  const words = splitWords(str);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function printUsage() {
  console.log(`
${colors.bold}${colors.cyan}React Boilerplate - Page Generator${colors.reset}

${colors.bold}Usage:${colors.reset}
  pnpm g <page-name>             ${colors.dim}Generate page with CLI argument${colors.reset}
  pnpm generate:page             ${colors.dim}Interactive generator prompt${colors.reset}

${colors.bold}Examples:${colors.reset}
  pnpm g dashboard               ${colors.dim}-> src/pages/dashboard.tsx (/dashboard)${colors.reset}
  pnpm g "about us"              ${colors.dim}-> src/pages/about-us.tsx (/about-us)${colors.reset}
  pnpm g user-profile            ${colors.dim}-> src/pages/user-profile.tsx (/user-profile)${colors.reset}
`);
}

function insertIntoListed(content, key, url, name) {
  const keyRegex = new RegExp(`\\b${key}\\s*:`);
  if (keyRegex.test(content)) {
    throw new Error(`Key "${key}" already exists in src/constants/listed.tsx`);
  }

  const listedIndex = content.indexOf('export const listed');
  if (listedIndex === -1) {
    throw new Error('Could not find "export const listed" in src/constants/listed.tsx');
  }

  const lastBraceIndex = content.lastIndexOf('}');
  if (lastBraceIndex === -1 || lastBraceIndex < listedIndex) {
    throw new Error('Could not find closing "}" for listed object in src/constants/listed.tsx');
  }

  const beforeClosing = content.slice(0, lastBraceIndex).trimEnd();
  const needsComma = beforeClosing.trim().endsWith('}') && !beforeClosing.trim().endsWith('},');
  const fixedBefore = needsComma ? `${beforeClosing},` : beforeClosing;

  const newEntry = `    ${key}: {\n        url: '${url}',\n        name: '${name}'\n    }`;

  return `${fixedBefore}\n${newEntry}\n${content.slice(lastBraceIndex)}`;
}

function insertIntoRouter(content, importName, pageImportPath, routePath) {
  if (content.includes(`path: "${routePath}"`) || content.includes(`path: '${routePath}'`)) {
    throw new Error(`Route with path "${routePath}" already exists in src/constants/router.tsx`);
  }

  const importStatement = `import ${importName} from "${pageImportPath}"`;
  let newContent = content;

  if (!newContent.includes(importStatement)) {
    const importRegex = /^import\s+.*?;?$/gm;
    let lastImportMatch = null;
    let match;
    while ((match = importRegex.exec(newContent)) !== null) {
      lastImportMatch = match;
    }

    if (lastImportMatch) {
      const insertPos = lastImportMatch.index + lastImportMatch[0].length;
      newContent = newContent.slice(0, insertPos) + '\n' + importStatement + newContent.slice(insertPos);
    } else {
      newContent = importStatement + '\n' + newContent;
    }
  }

  const routerArrayMatch = newContent.match(/createBrowserRouter\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!routerArrayMatch) {
    throw new Error('Could not locate "createBrowserRouter([ ... ])" in src/constants/router.tsx');
  }

  const arrayClosingIndex = newContent.lastIndexOf(']');
  if (arrayClosingIndex === -1) {
    throw new Error('Could not find closing bracket "]" in src/constants/router.tsx');
  }

  const beforeClosing = newContent.slice(0, arrayClosingIndex).trimEnd();
  const needsComma = beforeClosing.trim().endsWith('}') && !beforeClosing.trim().endsWith('},');
  const fixedBefore = needsComma ? `${beforeClosing},` : beforeClosing;

  const newRouteEntry = `    {\n        path: "${routePath}",\n        element: <${importName} />\n    },`;

  newContent = `${fixedBefore}\n${newRouteEntry}\n${newContent.slice(arrayClosingIndex)}`;
  return newContent;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const flags = process.argv.slice(2).filter((arg) => arg.startsWith('-'));

  if (flags.includes('-h') || flags.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  let rawName = args.join(' ').trim();

  if (!rawName) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log(`\n${colors.bold}${colors.cyan}✨ React Boilerplate Page Generator ✨${colors.reset}\n`);
      const answer = await rl.question(`${colors.bold}Enter page name (e.g. Dashboard, About Us, Profile): ${colors.reset}`);
      rawName = answer.trim();
    } finally {
      rl.close();
    }
  }

  if (!rawName) {
    console.error(`${colors.red}✖ Error: Page name cannot be empty.${colors.reset}`);
    printUsage();
    process.exit(1);
  }

  const pascalName = toPascalCase(rawName);
  const camelName = toCamelCase(rawName);
  const kebabName = toKebabCase(rawName);
  const displayName = toTitleCase(rawName);
  const componentName = `${pascalName}Page`;
  const importName = pascalName;
  const fileName = `${kebabName}.tsx`;
  const routePath = `/${kebabName}`;

  const pagesDir = path.join(rootDir, 'src', 'pages');
  const pageFilePath = path.join(pagesDir, fileName);
  const listedFilePath = path.join(rootDir, 'src', 'constants', 'listed.tsx');
  const routerFilePath = path.join(rootDir, 'src', 'constants', 'router.tsx');

  console.log(`\n${colors.bold}Generating Page:${colors.reset}`);
  console.log(`  ${colors.dim}• Component:${colors.reset}   ${colors.green}${componentName}${colors.reset}`);
  console.log(`  ${colors.dim}• File Path:${colors.reset}   ${colors.cyan}src/pages/${fileName}${colors.reset}`);
  console.log(`  ${colors.dim}• Route Path:${colors.reset}  ${colors.yellow}${routePath}${colors.reset}`);
  console.log(`  ${colors.dim}• Listed Key:${colors.reset}  ${colors.magenta}listed.${camelName}${colors.reset}`);
  console.log(`  ${colors.dim}• Name:${colors.reset}        ${displayName}\n`);

  // 1. Check if page file already exists
  if (fs.existsSync(pageFilePath)) {
    console.error(`${colors.red}✖ Error: File src/pages/${fileName} already exists.${colors.reset}`);
    process.exit(1);
  }

  // 2. Read listed.tsx and router.tsx
  if (!fs.existsSync(listedFilePath)) {
    console.error(`${colors.red}✖ Error: src/constants/listed.tsx not found.${colors.reset}`);
    process.exit(1);
  }
  if (!fs.existsSync(routerFilePath)) {
    console.error(`${colors.red}✖ Error: src/constants/router.tsx not found.${colors.reset}`);
    process.exit(1);
  }

  const listedContent = fs.readFileSync(listedFilePath, 'utf-8');
  const routerContent = fs.readFileSync(routerFilePath, 'utf-8');

  // 3. Prepare updated contents and validate before writing anything
  let updatedListed;
  let updatedRouter;

  try {
    updatedListed = insertIntoListed(listedContent, camelName, routePath, displayName);
  } catch (err) {
    console.error(`${colors.red}✖ Error updating listed.tsx: ${err.message}${colors.reset}`);
    process.exit(1);
  }

  try {
    const importPath = `../pages/${kebabName}`;
    updatedRouter = insertIntoRouter(routerContent, importName, importPath, routePath);
  } catch (err) {
    console.error(`${colors.red}✖ Error updating router.tsx: ${err.message}${colors.reset}`);
    process.exit(1);
  }

  // 4. Create page component content
  const pageTemplate = `const ${componentName} = () => {
    return (
        <div>
            <h1>${displayName}</h1>
        </div>
    )
}

export default ${componentName}
`;

  // 5. Write all files
  try {
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(pageFilePath, pageTemplate, 'utf-8');
    console.log(`${colors.green}✔ Created:${colors.reset} src/pages/${fileName}`);

    fs.writeFileSync(listedFilePath, updatedListed, 'utf-8');
    console.log(`${colors.green}✔ Updated:${colors.reset} src/constants/listed.tsx`);

    fs.writeFileSync(routerFilePath, updatedRouter, 'utf-8');
    console.log(`${colors.green}✔ Updated:${colors.reset} src/constants/router.tsx`);

    console.log(`\n${colors.bold}${colors.green}🎉 Page "${displayName}" successfully generated and registered!${colors.reset}\n`);
  } catch (err) {
    console.error(`${colors.red}✖ File write error: ${err.message}${colors.reset}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Unexpected error: ${err.message}${colors.reset}`);
  process.exit(1);
});
