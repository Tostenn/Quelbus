<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Les bus d'une ligne ont bougé : poussé tout de suite (Pusher) aux pages ouvertes sur cette ligne
 * (canal « line.{id} ») et à la page « En direct » (canal « live »).
 *
 * Envoyé sans file d'attente : quelques dizaines de millisecondes de plus pour le téléphone qui envoie,
 * mais la position arrive aux autres sans attendre le prochain passage du worker.
 */
class BusesUpdated implements ShouldBroadcastNow
{
    use Dispatchable;

    /**
     * @param  list<array>  $buses  tous les bus en direct de la ligne (liste complète, pas un différentiel)
     */
    public function __construct(public int $lineId, public array $buses) {}

    /**
     * @return list<Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel("line.{$this->lineId}"), new Channel('live')];
    }

    public function broadcastAs(): string
    {
        return 'buses';
    }

    /**
     * @return array{line_id: int, buses: list<array>}
     */
    public function broadcastWith(): array
    {
        return ['line_id' => $this->lineId, 'buses' => $this->buses];
    }
}
