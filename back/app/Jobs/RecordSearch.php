<?php

namespace App\Jobs;

use App\Services\Transit\SearchIndex;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Enregistre une recherche dans l'index des trajets, hors de la réponse à l'utilisateur.
 */
class RecordSearch implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @param  array<string, mixed>  $search  voir SearchIndex::record()
     */
    public function __construct(public array $search) {}

    public function handle(SearchIndex $index): void
    {
        $index->record($this->search);
    }
}
