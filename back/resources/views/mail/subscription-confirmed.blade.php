<x-mail::message>
# Bonjour {{ $subscriber->first_name }},

@if ($subscriber->isContributor())
Merci de vouloir donner un coup de main à QuelBus&nbsp;! Votre inscription est bien enregistrée.

Les contributeurs s'organisent sur **le groupe WhatsApp QuelBus**&nbsp;: on y partage les lignes à vérifier, les erreurs repérées et les prochaines étapes. C'est le meilleur endroit pour commencer.

<x-mail::button :url="$whatsappUrl">
Rejoindre le groupe WhatsApp
</x-mail::button>

**Vous connaissez une ligne&nbsp;?** Ouvrez sa page sur QuelBus, vérifiez les arrêts et cliquez sur «&nbsp;Signaler une erreur&nbsp;» s'il manque quelque chose. C'est l'aide la plus utile, et elle ne demande aucune compétence technique.

<x-mail::button :url="$siteUrl.'/lignes'" color="dark">
Vérifier une ligne
</x-mail::button>

Vous codez, dessinez ou cartographiez&nbsp;? Le projet est open source&nbsp;: [le code est sur GitHub]({{ $repoUrl }}).
@else
Merci pour votre inscription&nbsp;! Elle est bien enregistrée.

QuelBus est déjà en ligne&nbsp;: indiquez votre départ et votre destination, il vous dit quelle ligne prendre, où monter et où descendre.

<x-mail::button :url="$siteUrl.'/recherche'">
Trouver mon bus
</x-mail::button>

On vous préviendra par email des nouveautés&nbsp;: nouvelles lignes, correspondances, horaires.

Il existe aussi **un groupe WhatsApp** pour échanger autour du projet&nbsp;: poser vos questions, partager vos trajets, proposer des idées.

<x-mail::button :url="$whatsappUrl" color="dark">
Rejoindre le groupe WhatsApp
</x-mail::button>
@endif

Le meilleur coup de pouce&nbsp;: parlez de QuelBus autour de vous.

À très vite,<br>
L'équipe QuelBus

<x-mail::subcopy>
Vous recevez cet email parce que vous vous êtes inscrit(e) sur [quelbus.ci]({{ $siteUrl }}). [Ne plus recevoir d'emails]({{ $subscriber->unsubscribeUrl() }})
</x-mail::subcopy>
</x-mail::message>
