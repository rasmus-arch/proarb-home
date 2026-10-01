<?php
/**
 * Tar emot offertformuläret på cPanel/Apache.
 * Skickar mail via serverns inbyggda mail()-funktion.
 *
 * Vid fel skickas besökaren tillbaka till sidan formuläret låg på med
 * ?fel=1 (ogiltiga uppgifter) eller ?fel=2 (mailet gick inte att skicka),
 * och formuläret visar ett meddelande.
 */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /kontakt/');
    exit;
}

// Sidan formuläret skickades från – bara interna sökvägar godtas
$sida = (string) ($_POST['sida'] ?? '/kontakt/');
if (!preg_match('#^/[A-Za-z0-9/_-]*$#', $sida) || strpos($sida, '//') !== false) {
    $sida = '/kontakt/';
}
function tillbaka($sida, $fel) {
    header('Location: ' . $sida . '?fel=' . $fel . '#offertformular');
    exit;
}

// Honeypot: om fältet är ifyllt är det en bot – låtsas att det gick bra
if (!empty($_POST['bot-field'])) {
    header('Location: /tack/');
    exit;
}

// Mailet är ren text, så HTML-kodning behövs inte – bara trimning och
// borttagna radbrytningar i enradsfält (skydd mot header-injektion)
function rad($value) {
    return trim(str_replace(["\r", "\n"], ' ', strip_tags((string) $value)));
}
function text($value) {
    return trim(strip_tags((string) $value));
}

$to      = 'info@proarb.se';
$namn    = rad($_POST['namn'] ?? '');
$foretag = rad($_POST['foretag'] ?? '');
$epost   = filter_var(trim($_POST['epost'] ?? ''), FILTER_VALIDATE_EMAIL);
$telefon = rad($_POST['telefon'] ?? '');
$bransch = rad($_POST['bransch'] ?? '');
$antal   = rad($_POST['antal'] ?? '');
$behov   = isset($_POST['behov'])
    ? implode(', ', array_map('rad', (array) $_POST['behov']))
    : '';
$meddelande = text($_POST['meddelande'] ?? '');

if ($namn === '' || $foretag === '' || !$epost) {
    tillbaka($sida, 1);
}

// Ämnesraden kodas enligt RFC 2047 så att å, ä och ö visas rätt i alla mailprogram
$subject = "Ny offertförfrågan från $namn ($foretag)";
$subjectEncoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$body = "Namn: $namn\n"
      . "Företag: $foretag\n"
      . "E-post: $epost\n"
      . "Telefon: $telefon\n"
      . "Bransch: $bransch\n"
      . "Ungefär antal personer: $antal\n"
      . "Behov: $behov\n\n"
      . "Meddelande:\n$meddelande\n";

$fromName = '=?UTF-8?B?' . base64_encode('Proarb webbformulär') . '?=';
$headers = "From: $fromName <webbformular@proarb.se>\r\n"
         . "Reply-To: $epost\r\n"
         . "MIME-Version: 1.0\r\n"
         . "Content-Type: text/plain; charset=UTF-8\r\n"
         . "Content-Transfer-Encoding: 8bit\r\n";

$skickat = mail($to, $subjectEncoded, $body, $headers);

if (!$skickat) {
    tillbaka($sida, 2);
}

header('Location: /tack/');
exit;
