<?php
/**
 * 301 från gamla WooCommerce-produktadresser (/product/<slug>/) till nya sajten.
 *
 * Gamla sajten hade en adress per storlek och färg (~68 000 st). Tabellen i
 * gamla-produkter/ pekar varje gammal adress på motsvarande produktsida, eller
 * på rätt kategori om produkten inte finns med på nya sajten. Tabellen är
 * uppdelad på 256 filer (md5-prefix) så att varje anrop bara läser en liten fil.
 */
$slug = strtolower(trim((string) ($_GET['s'] ?? ''), '/'));
$to = '/arbetsklader/';

if (preg_match('/^[a-z0-9-]{1,200}$/', $slug)) {
    if (is_file(__DIR__ . "/produkt/$slug/index.html")) {
        $to = "/produkt/$slug/";
    } else {
        $file = __DIR__ . '/gamla-produkter/' . substr(md5($slug), 0, 2) . '.json';
        $map = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        if (is_array($map) && isset($map[$slug]) && preg_match('#^/[a-z0-9/-]+/$#', $map[$slug])) {
            $to = $map[$slug];
        }
    }
}

header('Location: ' . $to, true, 301);
header('Cache-Control: public, max-age=86400');
exit;
