<?php

namespace App\Console\Commands;

use App\Models\Trip;
use App\Models\TripPoint;
use App\Services\Live\TripTracker;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('transit:trips-cleanup')]
#[Description('Termine les voyages partagés silencieux et efface les points GPS bruts trop anciens')]
class CleanupTrips extends Command
{
    /** Sans nouvelle position depuis ce délai, le voyage est terminé */
    private const SILENT_MINUTES = 10;

    /** Points bruts gardés pour une ligne dont on a le tracé */
    private const KEEP_HOURS = 2;

    /** Ligne dont on ne connaît que les terminus : les traces serviront à dessiner son tracé */
    private const KEEP_PARTIAL_DAYS = 30;

    public function handle(TripTracker $tracker): int
    {
        $silent = Trip::query()
            ->where('status', Trip::ACTIVE)
            ->where(fn ($q) => $q->where('last_point_at', '<', now()->subMinutes(self::SILENT_MINUTES))
                ->orWhere(fn ($q) => $q->whereNull('last_point_at')->where('started_at', '<', now()->subMinutes(self::SILENT_MINUTES))))
            ->get();
        foreach ($silent as $trip) {
            $tracker->end($trip);
        }

        $deleted = TripPoint::query()
            ->where('recorded_at', '<', now()->subHours(self::KEEP_HOURS))
            ->whereHas('trip.direction', fn ($q) => $q->where('is_partial', false))
            ->delete();
        $deleted += TripPoint::query()->where('recorded_at', '<', now()->subDays(self::KEEP_PARTIAL_DAYS))->delete();

        $this->info("{$silent->count()} voyage(s) terminé(s), {$deleted} point(s) effacé(s).");

        return self::SUCCESS;
    }
}
