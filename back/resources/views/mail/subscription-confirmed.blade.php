<x-mail::message>
# Bonjour {{ $subscriber->first_name }},

@if ($subscriber->profile === 'contributeur')
Merci de vouloir contribuer à QuelBus ! Votre inscription est bien enregistrée.

QuelBus est déjà en ligne. On revient vers vous avec des pistes concrètes pour mettre la main à la pâte : vérifier des lignes sur le terrain, coder, dessiner ou cartographier les arrêts.

En attendant, le code et les discussions sont ouverts :

<x-mail::button :url="$repoUrl">
Voir le projet sur GitHub
</x-mail::button>
@elseif ($subscriber->profile === 'les_deux')
Merci de nous rejoindre ! Votre inscription est bien enregistrée.

QuelBus est déjà en ligne : essayez-le dès maintenant. On revient vers vous pour voir comment vous pouvez aider à l'améliorer.

<x-mail::button :url="$repoUrl">
Découvrir le projet sur GitHub
</x-mail::button>
@else
Merci pour votre inscription ! Elle est bien enregistrée.

QuelBus est déjà en ligne : indiquez votre départ et votre destination, il vous dit quelle ligne prendre, où monter et où descendre. On vous écrira quand il y aura du nouveau : nouvelles lignes, correspondances, horaires.

<x-mail::button :url="$siteUrl.'/recherche'">
Trouver mon bus
</x-mail::button>
@endif

Le meilleur coup de pouce : parlez de QuelBus autour de vous.

<x-mail::button :url="$siteUrl" color="success">
Partager QuelBus
</x-mail::button>

À très vite,<br>
L'équipe QuelBus

<x-mail::subcopy>
Vous recevez cet email parce que vous vous êtes inscrit(e) sur {{ $siteUrl }}. Pour ne plus rien recevoir, répondez simplement à ce message.
</x-mail::subcopy>
</x-mail::message>
