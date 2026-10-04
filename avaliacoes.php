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

// Procura a config fora do public_html (um ou dois níveis acima)
$key = '';
foreach ([dirname(__DIR__) . '/ss-config.php', dirname(__DIR__, 2) . '/ss-config.php'] as $cfgFile) {
  if (is_file($cfgFile)) { $cfg = include $cfgFile; $key = is_array($cfg) ? trim($cfg['GOOGLE_PLACES_KEY'] ?? '') : ''; break; }
}

function google_get($url, $key, &$status) {
  $headers = ['X-Goog-Api-Key: ' . $key, 'X-Goog-FieldMask: rating,userRatingCount'];
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_HTTPHEADER => $headers]);
    $raw = curl_exec($ch);
    $status = $raw === false ? 'curl: ' . curl_error($ch) : (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $raw;
  }
  if (!ini_get('allow_url_fopen')) { $status = 'sem curl e sem allow_url_fopen'; return false; }
  $ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true, 'header' => implode("\r\n", $headers) . "\r\n"]]);
  $raw = @file_get_contents($url, false, $ctx);
  $status = isset($http_response_header[0]) ? $http_response_header[0] : 'sem resposta';
  return $raw;
}

$motivo = 'ss-config.php nao encontrado ou sem chave';
$fresh = null;
if ($key !== '') {
  $raw = google_get('https://places.googleapis.com/v1/places/' . PLACE_ID, $key, $status);
  $data = $raw ? json_decode($raw, true) : null;
  if (isset($data['rating'], $data['userRatingCount'])) {
    $fresh = ['rating' => (float) $data['rating'], 'count' => (int) $data['userRatingCount'], 'updated' => date('c')];
    @file_put_contents($cache, json_encode($fresh), LOCK_EX);
  } else {
    $motivo = 'google: ' . $status . (isset($data['error']['message']) ? ' - ' . $data['error']['message'] : '');
  }
}

if ($fresh) { echo json_encode($fresh); exit; }
if ($saved) { @touch($cache, time() - TTL + 3600); echo json_encode($saved); exit; } // tenta de novo em 1h
http_response_code(503);
echo json_encode(['error' => 'indisponivel', 'motivo' => $motivo]);
