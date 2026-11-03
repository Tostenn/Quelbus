<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{ $done ? 'Désinscription confirmée' : 'Se désinscrire' }} | QuelBus</title>
<link rel="icon" href="{{ config('app.frontend_url') }}/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: #faf7f2; color: #1a1613; font: 17px/1.55 Archivo, Helvetica, Arial, sans-serif; }
main { width: 100%; max-width: 480px; text-align: center; }
.logo { display: inline-block; margin-bottom: 28px; }
.card { background: #fff; border: 1px solid #e6dfd5; border-radius: 22px; padding: 36px 28px; box-shadow: 0 24px 48px -32px rgba(26, 22, 19, .35); border-top: 6px solid #ce5b22; }
h1 { margin: 0 0 12px; font-size: 26px; line-height: 1.15; letter-spacing: -.02em; font-weight: 800; }
p { margin: 0 0 14px; color: #6b6259; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 22px; margin-top: 8px; border: 0; border-radius: 14px; background: #ce5b22; color: #fff; font: 800 16px/1.1 Archivo, Helvetica, Arial, sans-serif; text-decoration: none; cursor: pointer; }
.btn:hover { background: #b84e1b; }
.btn-ghost { background: transparent; color: #1a1613; border: 2px solid #1a1613; }
.btn-ghost:hover { background: #f1ebe1; }
</style>
</head>
<body>
<main>
<a class="logo" href="{{ config('app.frontend_url') }}"><img src="{{ config('app.frontend_url') }}/email/quelbus-logo.png" width="168" height="28" alt="QuelBus"></a>
<div class="card">
@if ($done)
<h1>C’est fait, {{ $subscriber->first_name }}.</h1>
<p>Vous ne recevrez plus d’emails de QuelBus à l’adresse {{ $subscriber->email }}.</p>
<p>Le site reste bien sûr à votre disposition.</p>
<a class="btn btn-ghost" href="{{ config('app.frontend_url') }}">Retour sur QuelBus</a>
@else
<h1>Ne plus recevoir nos emails ?</h1>
<p>{{ $subscriber->first_name }}, vous ne recevrez plus les nouvelles de QuelBus à l’adresse {{ $subscriber->email }}.</p>
<form method="post" action="{{ $action }}">
<button class="btn" type="submit">Me désinscrire</button>
</form>
@endif
</div>
</main>
</body>
</html>
