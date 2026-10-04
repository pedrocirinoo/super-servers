<?php
// Nota e total de avaliações do Google, atualizados no máximo a cada 24h.
// A chave fica fora do public_html, em ../ss-config.php:
//   <?php return ['GOOGLE_PLACES_KEY' => 'SUA_CHAVE'];
// Se o Google falhar, devolve o último valor salvo (a página mantém o que já mostra).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=3600');

const PLACE_ID = 'ChIJx0XOS0xhzpQR39HtpJgM5zE';
const TTL = 86400;
$cache = __DIR__ . '/avaliacoes-cache.json';

$saved = is_file($cache) ? json_decode((string) file_get_contents($cache), true) : null;
if ($saved && time() - filemtime($cache) < TTL) { echo json_encode($saved); exit; }

$cfgFile = dirname(__DIR__) . '/ss-config.php';
$cfg = is_file($cfgFile) ? include $cfgFile : [];
$key = is_array($cfg) ? ($cfg['GOOGLE_PLACES_KEY'] ?? '') : '';

$fresh = null;
if ($key !== '') {
  $ctx = stream_context_create(['http' => [
    'timeout' => 8,
    'header' => "X-Goog-Api-Key: $key\r\nX-Goog-FieldMask: rating,userRatingCount\r\n",
  ]]);
  $raw = @file_get_contents('https://places.googleapis.com/v1/places/' . PLACE_ID, false, $ctx);
  $data = $raw ? json_decode($raw, true) : null;
  if (isset($data['rating'], $data['userRatingCount'])) {
    $fresh = ['rating' => (float) $data['rating'], 'count' => (int) $data['userRatingCount'], 'updated' => date('c')];
    @file_put_contents($cache, json_encode($fresh), LOCK_EX);
  }
}

if ($fresh) { echo json_encode($fresh); exit; }
if ($saved) { @touch($cache, time() - TTL + 3600); echo json_encode($saved); exit; } // tenta de novo em 1h
http_response_code(503);
echo json_encode(['error' => 'indisponivel']);
