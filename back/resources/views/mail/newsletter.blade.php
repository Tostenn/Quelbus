<x-mail::message>
{!! $body !!}

<x-mail::subcopy>
Vous recevez cet email parce que vous êtes inscrit(e) sur [quelbus.ci]({{ $siteUrl }}). On échange aussi sur le [groupe WhatsApp QuelBus]({{ $whatsappUrl }}).
@if ($unsubscribeUrl)
[Ne plus recevoir ces emails]({{ $unsubscribeUrl }})
@endif
</x-mail::subcopy>
</x-mail::message>
