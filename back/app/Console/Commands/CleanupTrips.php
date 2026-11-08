<?php

namespace App\Console\Commands;

use App\Models\Trip;
use App\Services\Live\TripTracker;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('transit:trips-cleanup')]
#[Description('Termine les voyages partagés silencieux (rien n\'est effacé : les voyages servent aux statistiques)')]
class CleanupTrips extends Command
{
    /** Sans nouvelle position depuis ce délai, le voyage est terminé */
    private const SILENT_MINUTES = 10;

    public function handle(TripTracker $tracker): int
    {
        $limit = now()->subMinutes(self::SILENT_MINUTES);
        // Sens encore inconnu : pas de last_point_at, mais updated_at bouge à chaque envoi
        $silent = Trip::query()
            ->where('status', Trip::ACTIVE)
            ->where(fn ($q) => $q->where('last_point_at', '<', $limit)
                ->orWhere(fn ($q) => $q->whereNull('last_point_at')->where('updated_at', '<', $limit)))
            ->get();
        foreach ($silent as $trip) {
            $tracker->end($trip);
        }

        $this->info("{$silent->count()} voyage(s) terminé(s).");

        return self::SUCCESS;
    }
}
