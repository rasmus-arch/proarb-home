<?php
/**
 * Tar emot offertformuläret på cPanel/Apache (ersätter Netlify Forms).
 * Skickar mail via serverns inbyggda mail()-funktion.
 */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /kontakt/');
    exit;
}

// Honeypot: om fältet är ifyllt är det en bot – låtsas att det gick bra
if (!empty($_POST['bot-field'])) {
    header('Location: /tack/');
    exit;
}

function clean($value) {
    return htmlspecialchars(trim((string) $value), ENT_QUOTES, 'UTF-8');
}

$to      = 'info@proarb.se';
$namn    = clean($_POST['namn'] ?? '');
$foretag = clean($_POST['foretag'] ?? '');
$epost   = filter_var(trim($_POST['epost'] ?? ''), FILTER_VALIDATE_EMAIL);
$telefon = clean($_POST['telefon'] ?? '');
$bransch = clean($_POST['bransch'] ?? '');
$antal   = clean($_POST['antal'] ?? '');
$meddelande = clean($_POST['meddelande'] ?? '');
$behov = isset($_POST['behov'])
    ? implode(', ', array_map('clean', (array) $_POST['behov']))
    : '';

if ($namn === '' || $foretag === '' || !$epost) {
    header('Location: /kontakt/?fel=1');
    exit;
}

$subject = "Ny offertförfrågan från $namn ($foretag)";
$body = "Namn: $namn\n"
      . "Företag: $foretag\n"
      . "E-post: $epost\n"
      . "Telefon: $telefon\n"
      . "Bransch: $bransch\n"
      . "Ungefär antal personer: $antal\n"
      . "Behov: $behov\n\n"
      . "Meddelande:\n$meddelande\n";

$headers = "From: webbformular@proarb.se\r\n"
         . "Reply-To: $epost\r\n"
         . "Content-Type: text/plain; charset=UTF-8\r\n";

@mail($to, $subject, $body, $headers);

header('Location: /tack/');
exit;
