<?php
$logFile = "acessos.txt";

$ip = $_SERVER['REMOTE_ADDR'];
$data = date("d/m/Y H:i:s");
$pagina = $_SERVER['REQUEST_URI'];
$referer = $_SERVER['HTTP_REFERER'] ?? null;

// Só grava se veio de outro site
if (!$referer) exit;

// Consulta país
$detalhesIp = @json_decode(file_get_contents("http://ipinfo.io/{$ip}/json"));
$pais = $detalhesIp->country ?? 'Desconhecido';

// Se quiser destacar referers suspeitos
if (str_contains($referer, 'revenda') || str_contains($referer, 'clube')) {
    $referer .= ' 🚨';
}

// Monta linha
$linha = "[{$data}] IP: {$ip} | País: {$pais} | Página: {$pagina} | Referer: {$referer}\n";

// Grava com fopen
$fp = @fopen($logFile, 'a');
if ($fp) {
    fwrite($fp, $linha);
    fclose($fp);
}
?>
