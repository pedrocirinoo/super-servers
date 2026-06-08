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

// ── Avaliações do Google (index.html) ──
// Chave fica em .env (fora do git). Se não houver chave/internet, mantém o que já está.
const PLACE_ID = 'ChIJx0XOS0xhzpQR39HtpJgM5zE';
const REVIEWS_TO_SHOW = 5;

async function injectReviews() {
  let key;
  try { key = readFileSync(join(root, '.env'), 'utf8').match(/GOOGLE_PLACES_KEY=(.+)/)?.[1]?.trim(); } catch {}
  if (!key) { console.log('  reviews: sem chave (.env) — mantendo as atuais'); return; }

  let data;
  try {
    const res = await fetch('https://places.googleapis.com/v1/places/' + PLACE_ID + '?languageCode=pt-BR', {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews' }
    });
    if (!res.ok) { console.log('  reviews: HTTP ' + res.status + ' — mantendo as atuais'); return; }
    data = await res.json();
  } catch (e) { console.log('  reviews: sem rede — mantendo as atuais'); return; }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const trunc = (s, n = 240) => {
    s = String(s).replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (lastSentence > n * 0.5) return cut.slice(0, lastSentence + 1); // termina numa frase completa
    return cut.replace(/\s+\S*$/, '') + '…';
  };
  // Correções só de erros claros (nome da marca, ortografia óbvia) — mantém a voz do cliente
  const fixSpelling = (s) => String(s)
    .replace(/\bSuperserves\b/gi, 'Super Servers')
    .replace(/\binfra\s+estrutura\b/gi, 'infraestrutura');
  const ratingStr = String(data.rating ?? '').replace('.', ',');
  const mapsUrl = 'https://www.google.com/maps/place/?q=place_id:' + PLACE_ID;
  const reviews = (data.reviews || []).slice(0, REVIEWS_TO_SHOW);

  // Nota agregada (vai no cabeçalho, coluna esquerda)
  const badge = '<a class="reviews-badge" href="' + mapsUrl + '" target="_blank" rel="noopener">'
    + '<span class="reviews-stars">★★★★★</span> <strong>' + ratingStr + '</strong> · '
    + (data.userRatingCount ?? 0) + ' avaliações no Google ›</a>';

  // Carrossel (coluna direita) — sem controles; as bolinhas ficam no cabeçalho
  let carousel = '\n          <div class="reviews-carousel" id="reviewsCarousel">\n'
    + '            <div class="reviews-viewport"><div class="reviews-track">\n';
  for (const r of reviews) {
    const stars = '★'.repeat(Math.round(r.rating || 5));
    const text = trunc(fixSpelling(r.text?.text || r.originalText?.text || ''), 300);
    const author = r.authorAttribution?.displayName || 'Cliente';
    carousel += '              <div class="review-slide"><div class="depoimento-card">\n'
      + '                <div class="depoimento-stars">' + stars + '</div>\n'
      + '                <p class="depoimento-quote">"' + esc(text) + '"</p>\n'
      + '                <div class="depoimento-autor"><span class="depoimento-nome">' + esc(author) + '</span><span class="depoimento-cargo">Avaliação no Google</span></div>\n'
      + '              </div></div>\n';
  }
  carousel += '            </div></div>\n'
    + '          </div>\n          ';

  const idxPath = join(root, 'index.html');
  let idx = readFileSync(idxPath, 'utf8');
  const reBadge = /<!-- #reviews-badge -->[\s\S]*?<!-- \/#reviews-badge -->/;
  const reCar = /<!-- #reviews-carousel -->[\s\S]*?<!-- \/#reviews-carousel -->/;
  if (!reBadge.test(idx) || !reCar.test(idx)) { console.log('  reviews: marcadores não encontrados'); return; }
  idx = idx.replace(reBadge, '<!-- #reviews-badge -->' + badge + '<!-- /#reviews-badge -->');
  idx = idx.replace(reCar, '<!-- #reviews-carousel -->' + carousel + '<!-- /#reviews-carousel -->');
  writeFileSync(idxPath, idx);
  console.log('  reviews: ' + reviews.length + ' injetadas (★' + ratingStr + ' · ' + (data.userRatingCount ?? 0) + ')');
}

await injectReviews();

console.log(`\nBuild concluído — ${changed} página(s) atualizada(s).`);
