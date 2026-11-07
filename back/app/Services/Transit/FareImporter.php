<?php

namespace App\Services\Transit;

use App\Models\City;
use App\Models\Line;
use App\Models\LineDirection;
use App\Models\LineSchedule;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Importe data/fares.json (scraper/fares.py) : tarifs par ligne, plages de service par sens.
 * Ce qui a été saisi dans le tableau de bord n'est jamais écrasé.
 */
class FareImporter
{
    /** Mots trop courants pour reconnaître un terminus */
    private const GENERIC = ['terminus', 'gare', 'de', 'du', 'la', 'le', 'les', 'des', 'd', 'l'];

    /**
     * @param  array{fares?: list<array>, schedules?: list<array>}  $data
     * @return array{fares: int, fares_kept: int, schedules: int, schedules_kept: int, anomalies: list<string>}
     */
    public function import(array $data): array
    {
        $report = ['fares' => 0, 'fares_kept' => 0, 'schedules' => 0, 'schedules_kept' => 0, 'anomalies' => []];

        DB::transaction(function () use ($data, &$report) {
            $lines = Line::query()->with('directions:id,line_id,origin_label,destination_label')->get()->keyBy('key');
            $this->importFares($data['fares'] ?? [], $lines, $report);
            $this->importSchedules($data['schedules'] ?? [], $lines, $report);
        });

        return $report;
    }

    /**
     * @param  Collection<string, Line>  $lines
     */
    private function importFares(array $fares, Collection $lines, array &$report): void
    {
        foreach ($fares as $fare) {
            $line = $lines[self::key($fare)] ?? null;
            if (! $line) {
                $report['anomalies'][] = "Tarif : ligne {$fare['ref']} ({$fare['city']}) absente du réseau.";

                continue;
            }
            if ($line->fare_edited_at) {
                $report['fares_kept']++;

                continue;
            }
            $line->update(['fare' => $fare['fare'], 'fare_type' => $fare['fare_type']]);
            $report['fares']++;
        }
    }

    /**
     * Les rattachements sûrs (deux terminus reconnus) passent avant les approximatifs (un seul) :
     * une variante de la ligne ne prend pas la place du bon relevé.
     *
     * @param  Collection<string, Line>  $lines
     */
    private function importSchedules(array $schedules, Collection $lines, array &$report): void
    {
        $matches = [];
        foreach ($schedules as $schedule) {
            $line = $lines[self::key($schedule)] ?? null;
            $match = $line ? $this->matchDirection($line->directions, $schedule['direction']) : null;
            if (! $match) {
                $report['anomalies'][] = "Horaires : sens « {$schedule['direction']} » de la ligne {$schedule['ref']} introuvable.";

                continue;
            }
            $matches[] = [$schedule, ...$match];
        }
        usort($matches, fn ($a, $b) => $b[2] <=> $a[2]); // exacts d'abord (tri stable)

        $filled = [];
        foreach ($matches as [$schedule, $direction, $exact]) {
            $day = in_array($schedule['day_type'], LineSchedule::DAY_TYPES, true) ? $schedule['day_type'] : 'tous';
            $label = "« {$schedule['direction']} » ({$schedule['ref']}, {$day})";
            if (isset($filled[$direction->id][$day])) {
                $report['anomalies'][] = "Horaires : {$label} tombe sur un sens déjà rempli (variante de la ligne ?), ignoré.";

                continue;
            }
            $filled[$direction->id][$day] = true;

            // Horaires saisis dans le tableau de bord : l'admin a remplacé tous ceux du sens
            if (LineSchedule::query()->where('line_direction_id', $direction->id)->whereNotNull('user_id')->exists()) {
                $report['schedules_kept']++;

                continue;
            }
            if (! $exact) {
                $report['anomalies'][] = "Horaires : {$label} rattaché à « {$direction->origin_label} → {$direction->destination_label} » sur un seul terminus, à vérifier.";
            }
            LineSchedule::query()->updateOrCreate(
                ['line_direction_id' => $direction->id, 'day_type' => $day],
                [
                    'first_departure' => $schedule['first_departure'],
                    'last_departure' => $schedule['last_departure'],
                    'source' => $schedule['source'] ?? null,
                    'source_url' => $schedule['source_url'] ?? null,
                    'observed_on' => $schedule['observed_on'] ?? null,
                ],
            );
            $report['schedules']++;
        }
    }

    private static function key(array $entry): string
    {
        $key = 'sotra:'.(ltrim(strtolower((string) $entry['ref']), '0') ?: '0');
        $city = $entry['city'] ?? City::DEFAULT;

        return $city === City::DEFAULT ? $key : "{$city}:{$key}";
    }

    /**
     * « Koweït Résidentiel -> Liberté Adjamé » : le sens dont l'origine et la destination
     * partagent le plus de mots avec les deux bouts.
     * Un terminus renommé (« Gare Nord » pour « Mosquée Adjamé ») ne laisse qu'un bout reconnu :
     * accepté seulement si un seul sens est dans ce cas.
     *
     * @param  Collection<int, LineDirection>  $directions
     * @return array{LineDirection, bool}|null le sens, et s'il est reconnu par ses deux terminus
     */
    private function matchDirection(Collection $directions, string $label): ?array
    {
        $ends = preg_split('/\s*(?:->|→|>)\s*/u', $label);
        if (count($ends) !== 2) {
            return null;
        }
        [$from, $to] = array_map($this->words(...), $ends);

        $best = null;
        $bestScore = 0;
        $oneEnd = [];
        foreach ($directions as $direction) {
            $a = count(array_intersect($from, $this->words((string) $direction->origin_label)));
            $b = count(array_intersect($to, $this->words((string) $direction->destination_label)));
            if ($a && $b && $a + $b > $bestScore) {
                [$best, $bestScore] = [$direction, $a + $b];
            } elseif ($a xor $b) {
                $oneEnd[] = $direction;
            }
        }

        return match (true) {
            $best !== null => [$best, true],
            count($oneEnd) === 1 => [$oneEnd[0], false],
            default => null,
        };
    }

    /**
     * @return list<string>
     */
    private function words(string $text): array
    {
        return array_values(array_diff(explode(' ', TransitImporter::normalize($text)), self::GENERIC, ['']));
    }
}
