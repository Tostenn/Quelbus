<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Compteurs anonymes par jour : aucune donnée personnelle, aucun cookie.
 */
class Stats
{
    public static function record(string $counter): void
    {
        if (! in_array($counter, ['visits', 'searches'], true)) {
            throw new InvalidArgumentException("Compteur inconnu : {$counter}");
        }

        DB::table('daily_stats')->upsert(
            ['date' => now()->toDateString(), $counter => 1],
            ['date'],
            [$counter => DB::raw("daily_stats.{$counter} + 1")],
        );
    }

    /**
     * @return array{visits: int, searches: int}
     */
    public static function totals(): array
    {
        $row = DB::table('daily_stats')
            ->selectRaw('coalesce(sum(visits), 0) as visits, coalesce(sum(searches), 0) as searches')
            ->first();

        return ['visits' => (int) $row->visits, 'searches' => (int) $row->searches];
    }
}
