'use strict';

const fs = require('node:fs');
const path = require('node:path');

const passwordHash = process.env.PASSWORD_HASH;
const intelligenceApiKey = process.env.IPAPI_IS_KEY;

if (!passwordHash || !/^[a-f0-9]{40}$/i.test(passwordHash)) {
  throw new Error('PASSWORD_HASH must be a 40-character SHA-1 digest');
}
if (!intelligenceApiKey) {
  throw new Error('Missing required GitHub secret: IPAPI_IS_KEY');
}

const environmentFile = path.resolve(process.argv[2] ?? 'src/environments/environment.ts');
let source = fs.readFileSync(environmentFile, 'utf8');

function replacePlaceholder(property, placeholder, value) {
  const expression = new RegExp(`^(\\s*${property}\\s*:\\s*)(['"])(.*?)\\2`, 'm');
  const match = expression.exec(source);

  if (!match || match[3] !== placeholder) {
    throw new Error(`Could not find expected ${property} placeholder`);
  }

  source = source.replace(expression, () => `${match[1]}${JSON.stringify(value)}`);
}

replacePlaceholder('passwordHash', 'PASSWORD_HASH_PLACEHOLDER', passwordHash);
replacePlaceholder('intelligenceApiKey', 'IPAPI_IS_PLACEHOLDER', intelligenceApiKey);

fs.writeFileSync(environmentFile, source);
