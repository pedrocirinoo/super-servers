// build.mjs — injeta os partials (header/footer) nas páginas.
// Fonte única: partials/header.html e partials/footer.html
// Uso: node build.mjs   (rode antes de publicar quando mexer em nav/rodapé)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\s+$/, '');

const header = read('partials/header.html');
const footer = read('partials/footer.html');

const pages = [
  'index.html', 'produtos.html', 'sobre.html', 'contato.html',
  'garantia.html', 'acionar-garantia.html', 'privacidade.html', 'termos.html',
];

// Link do topo que recebe class="active" em cada página
const activeFor = {
  'produtos.html': 'produtos.html',
  'sobre.html': 'sobre.html',
  'contato.html': 'contato.html',
};

let changed = 0;
for (const page of pages) {
  const path = join(root, page);
  const original = readFileSync(path, 'utf8');

  // header com o link da página atual marcado como ativo
  let h = header;
  const navHref = activeFor[page];
  if (navHref) {
    h = h.replace(`<a href="${navHref}">`, `<a href="${navHref}" class="active">`);
  }

  let html = original
    .replace(/<nav>[\s\S]*?<\/nav>/, () => h)
    .replace(/<footer>[\s\S]*?<\/footer>/, () => footer);

  if (html !== original) {
    writeFileSync(path, html);
    changed++;
    console.log('  atualizado:', page);
  } else {
    console.log('  inalterado:', page);
  }
}

console.log(`\nBuild concluído — ${changed} página(s) atualizada(s).`);
