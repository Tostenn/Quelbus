<x-mail::message>
# Bonjour {{ $subscriber->first_name }},

@if ($subscriber->profile === 'contributeur')
Merci de vouloir contribuer à QuelBus ! Votre inscription est bien enregistrée.

On revient vers vous **très bientôt** avec les premières pistes pour mettre la main à la pâte : tester l'application, vérifier des lignes, coder, dessiner ou cartographier les arrêts SOTRA.

En attendant, vous pouvez déjà jeter un œil au code et aux premières discussions :

<x-mail::button :url="$repoUrl">
Voir le projet sur GitHub
</x-mail::button>
@elseif ($subscriber->profile === 'les_deux')
Merci de nous rejoindre ! Votre inscription est bien enregistrée.

Vous serez parmi les premiers à tester QuelBus, et on revient vers vous **très bientôt** pour voir comment vous pouvez aider à le construire.

<x-mail::button :url="$repoUrl">
Découvrir le projet sur GitHub
</x-mail::button>
@else
Merci pour votre inscription ! Elle est bien enregistrée.

On vous écrit **très bientôt**, dès que QuelBus est prêt : vous saurez enfin quelle ligne SOTRA prendre, où monter et où descendre, pour aller où vous voulez à Abidjan.
@endif

Le meilleur coup de pouce en attendant : parlez de QuelBus autour de vous.

<x-mail::button :url="$siteUrl" color="success">
Partager QuelBus
</x-mail::button>

À très vite,<br>
L'équipe QuelBus

<x-mail::subcopy>
Vous recevez cet email parce que vous vous êtes inscrit(e) sur {{ $siteUrl }}. Pour ne plus rien recevoir, répondez simplement à ce message.
</x-mail::subcopy>
</x-mail::message>
