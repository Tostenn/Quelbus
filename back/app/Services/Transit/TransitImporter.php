<?php

namespace App\Services\Transit;

use App\Models\Line;
use App\Models\LineDirection;
use App\Models\Stop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Importe le JSON produit par scraper/scrape.py (format décrit dans scraper/README.md).
 *
 * Dans la source, chaque entrée de « lines » est un sens de circulation (A → B).
 * L'import regroupe les sens d'une même ligne :
 *  - SOTRA : même numéro (201, 206…) ;
 *  - gbaka / woro-woro : mêmes terminus dans les deux sens, dans la même catégorie ;
 *  - autre : chaque entrée est sa propre ligne.
 *
 * Idempotent : lignes, sens et arrêts sont retrouvés par leur clé, rien n'est dupliqué.
 */
class TransitImporter
{
    /** @var array<string, true> */
    private array $usedSlugs = [];

    /**
     * @param  array{stops: list<array>, lines: list<array>}  $data
     */
    public function import(array $data, bool $prune = false): ImportReport
    {
        if (! isset($data['stops'], $data['lines']) || ! is_array($data['stops']) || ! is_array($data['lines'])) {
            throw new InvalidArgumentException('Format inattendu : les clés « stops » et « lines » sont obligatoires.');
        }

        $report = new ImportReport;

        DB::transaction(function () use ($data, $prune, $report) {
            $stopIds = $this->importStops($data['stops'], $report);
            $this->importDirections($data['lines'], $stopIds, $report);

            if ($prune) {
                $this->prune($data['lines'], $report);
            }
        });

        return $report;
    }

    /**
     * @param  list<array>  $stops
     * @return array<int, int> id de l'arrêt dans le fichier => id en base
     */
    private function importStops(array $stops, ImportReport $report): array
    {
        $existing = [];
        foreach (Stop::query()->get(['id', 'name', 'lat', 'lng', 'slug']) as $stop) {
            $existing[$this->stopKey($stop->name, $stop->lat, $stop->lng)] = $stop->id;
            $this->usedSlugs['stop:'.$stop->slug] = true;
        }

        $now = now();
        $toInsert = [];
        foreach ($stops as $stop) {
            $key = $this->stopKey($stop['name'], $stop['lat'], $stop['lon']);
            if (isset($existing[$key]) || isset($toInsert[$key])) {
                continue;
            }
            $toInsert[$key] = [
                'name' => $stop['name'],
                'slug' => $this->uniqueSlug('stop', $stop['name']),
                'lat' => round($stop['lat'], 6),
                'lng' => round($stop['lon'], 6),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk(array_values($toInsert), 500) as $chunk) {
            Stop::query()->insert($chunk);
        }
        $report->stopsCreated = count($toInsert);

        if ($toInsert) {
            foreach (Stop::query()->get(['id', 'name', 'lat', 'lng']) as $stop) {
                $existing[$this->stopKey($stop->name, $stop->lat, $stop->lng)] = $stop->id;
            }
        }

        $map = [];
        foreach ($stops as $stop) {
            $map[$stop['id']] = $existing[$this->stopKey($stop['name'], $stop['lat'], $stop['lon'])];
        }

        return $map;
    }

    /**
     * @param  list<array>  $entries
     * @param  array<int, int>  $stopIds
     */
    private function importDirections(array $entries, array $stopIds, ImportReport $report): void
    {
        foreach (Line::query()->pluck('slug') as $slug) {
            $this->usedSlugs['line:'.$slug] = true;
        }

        $lines = Line::query()->get()->keyBy('key');
        $now = now();

        foreach ($entries as $entry) {
            $type = in_array($entry['type'] ?? null, Line::TYPES, true) ? $entry['type'] : 'autre';
            $key = $this->lineKey($type, $entry);

            $line = $lines->get($key);
            if (! $line) {
                $line = Line::query()->create([
                    'key' => $key,
                    'type' => $type,
                    'ref' => $entry['ref'] ?? null,
                    'name' => $this->lineName($entry),
                    'slug' => $this->uniqueSlug('line', $this->lineSlugSource($type, $entry)),
                    'category' => $entry['category'] ?? null,
                    'operator' => $entry['operator'] ?? null,
                ]);
                $lines->put($key, $line);
                $report->linesCreated++;
            }

            $sequence = [];
            foreach ($entry['stops'] as $fileStopId) {
                if (! isset($stopIds[$fileStopId])) {
                    $report->anomaly("{$entry['name']} : arrêt {$fileStopId} absent de la liste des arrêts, ignoré.");

                    continue;
                }
                $sequence[] = $stopIds[$fileStopId];
            }

            if (count($sequence) < 2) {
                $report->anomaly("{$entry['name']} : moins de 2 arrêts, ce sens ne pourra pas servir à la recherche.");
            }
            if ($type === 'sotra' && empty($entry['ref'])) {
                $report->anomaly("{$entry['name']} : ligne SOTRA sans numéro.");
            }

            $direction = LineDirection::query()->updateOrCreate(
                ['osm_relation_id' => $entry['id']],
                [
                    'line_id' => $line->id,
                    'name' => $entry['from'] && $entry['to'] ? "{$entry['from']} → {$entry['to']}" : $entry['name'],
                    'origin_label' => $entry['from'] ?? null,
                    'destination_label' => $entry['to'] ?? null,
                    'is_loop' => count($sequence) > 1 && $sequence[0] === end($sequence),
                    'stops_count' => count($sequence),
                    'geometry' => $entry['geometry'] ?? null,
                ],
            );
            $direction->wasRecentlyCreated ? $report->directionsCreated++ : $report->directionsUpdated++;

            DB::table('direction_stops')->where('line_direction_id', $direction->id)->delete();
            $rows = [];
            foreach ($sequence as $i => $stopId) {
                $rows[] = ['line_direction_id' => $direction->id, 'stop_id' => $stopId, 'sequence' => $i + 1];
            }
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('direction_stops')->insert($chunk);
            }
        }
    }

    /**
     * Supprime ce qui n'est plus dans le fichier : sens disparus, puis lignes et arrêts orphelins.
     *
     * @param  list<array>  $entries
     */
    private function prune(array $entries, ImportReport $report): void
    {
        $report->directionsDeleted = LineDirection::query()
            ->whereNotIn('osm_relation_id', array_column($entries, 'id'))
            ->delete();
        $report->linesDeleted = Line::query()->whereDoesntHave('directions')->delete();
        $report->stopsDeleted = Stop::query()->whereDoesntHave('directions')->delete();
    }

    private function lineKey(string $type, array $entry): string
    {
        if ($type === 'sotra' && ! empty($entry['ref'])) {
            return 'sotra:'.(ltrim(Str::lower($entry['ref']), '0') ?: '0');
        }
        if (in_array($type, ['gbaka', 'woro-woro'], true) && $entry['from'] && $entry['to']) {
            $ends = [Str::slug($entry['from']), Str::slug($entry['to'])];
            sort($ends);

            return $type.':'.Str::slug($entry['category'] ?? '').':'.implode('|', $ends);
        }

        return $type.':osm:'.$entry['id'];
    }

    private function lineName(array $entry): string
    {
        return $entry['from'] && $entry['to'] ? "{$entry['from']} ↔ {$entry['to']}" : $entry['name'];
    }

    private function lineSlugSource(string $type, array $entry): string
    {
        $ends = $entry['from'] && $entry['to'] ? "{$entry['from']} {$entry['to']}" : $entry['name'];

        return match ($type) {
            'sotra' => trim(($entry['ref'] ?? '').' '.$ends),
            'gbaka', 'woro-woro' => "{$type} {$ends}",
            default => $entry['name'],
        };
    }

    private function uniqueSlug(string $scope, string $source): string
    {
        $base = Str::slug($source) ?: $scope;
        $slug = $base;
        for ($i = 2; isset($this->usedSlugs[$scope.':'.$slug]); $i++) {
            $slug = "{$base}-{$i}";
        }
        $this->usedSlugs[$scope.':'.$slug] = true;

        return $slug;
    }

    private function stopKey(string $name, float|string $lat, float|string $lng): string
    {
        return sprintf('%s|%.6f|%.6f', $name, (float) $lat, (float) $lng);
    }
}
