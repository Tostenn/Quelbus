<?php

namespace App\Services\Transit;

use App\Models\City;
use App\Models\Line;
use App\Models\LineDirection;
use App\Models\Stop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Importe le JSON de scraper/scrape.py. Chaque entrée de « lines » y est un sens (A → B) :
 * les sens d'une même ligne sont regroupés (même numéro SOTRA, ou mêmes terminus pour gbaka et woro-woro).
 *
 * Le fichier peut couvrir plusieurs villes (clé « cities », et « city » sur chaque arrêt et chaque sens) ;
 * sans indication, tout est rattaché à Abidjan.
 */
class TransitImporter
{
    /** @var array<string, true> */
    private array $usedSlugs = [];

    /** @var array<string, int> slug de la ville => id */
    private array $cityIds = [];

    /**
     * @param  array{stops: list<array>, lines: list<array>, cities?: list<array>}  $data
     */
    public function import(array $data, bool $prune = false): ImportReport
    {
        if (! isset($data['stops'], $data['lines']) || ! is_array($data['stops']) || ! is_array($data['lines'])) {
            throw new InvalidArgumentException('Format inattendu : les clés « stops » et « lines » sont obligatoires.');
        }

        $report = new ImportReport;

        DB::transaction(function () use ($data, $prune, $report) {
            $this->importCities($data['cities'] ?? []);
            $stopIds = $this->importStops($data['stops'], $report);
            $this->importDirections($data['lines'], $stopIds, $report);

            if ($prune) {
                $this->prune($data['lines'], $report);
            }
        });

        return $report;
    }

    /**
     * @param  list<array{slug: string, name: string, bbox: array{float, float, float, float}, position?: int}>  $cities  bbox : sud, ouest, nord, est
     */
    private function importCities(array $cities): void
    {
        foreach ($cities as $i => $city) {
            [$south, $west, $north, $east] = $city['bbox'];
            City::query()->updateOrCreate(['slug' => $city['slug']], [
                'name' => $city['name'],
                'min_lat' => $south, 'min_lng' => $west, 'max_lat' => $north, 'max_lng' => $east,
                'position' => $city['position'] ?? $i + 1,
            ]);
        }
        $this->cityIds = City::query()->pluck('id', 'slug')->all();
    }

    private function cityId(?string $slug): int
    {
        $slug ??= City::DEFAULT;

        return $this->cityIds[$slug] ?? throw new InvalidArgumentException("Ville inconnue : « {$slug} » (à déclarer dans la clé « cities »).");
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
            $city = $stop['city'] ?? null;
            $toInsert[$key] = [
                'city_id' => $this->cityId($city),
                'name' => $stop['name'],
                'search_name' => self::normalize($stop['name']),
                'slug' => $this->uniqueSlug('stop', $this->withCity($stop['name'], $city)),
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
     * Écrit par lots : ligne par ligne, l'import prenait 45 min sur une base distante.
     *
     * @param  list<array>  $entries
     * @param  array<int, int>  $stopIds
     */
    private function importDirections(array $entries, array $stopIds, ImportReport $report): void
    {
        $now = now();
        $lineIds = Line::query()->pluck('id', 'key')->all();
        foreach (Line::query()->pluck('slug') as $slug) {
            $this->usedSlugs['line:'.$slug] = true;
        }

        $newLines = [];
        foreach ($entries as $i => $entry) {
            $type = in_array($entry['type'] ?? null, Line::TYPES, true) ? $entry['type'] : 'autre';
            $key = $this->lineKey($type, $entry);
            $entries[$i]['_type'] = $type;
            $entries[$i]['_key'] = $key;

            if (! isset($lineIds[$key]) && ! isset($newLines[$key])) {
                $newLines[$key] = [
                    'city_id' => $this->cityId($entry['city'] ?? null),
                    'key' => $key,
                    'type' => $type,
                    'ref' => $entry['ref'] ?? null,
                    'name' => $this->lineName($entry),
                    'slug' => $this->uniqueSlug('line', $this->withCity($this->lineSlugSource($type, $entry), $entry['city'] ?? null)),
                    'category' => $entry['category'] ?? null,
                    'operator' => $entry['operator'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }
        foreach (array_chunk(array_values($newLines), 500) as $chunk) {
            Line::query()->insert($chunk);
        }
        $report->linesCreated = count($newLines);
        if ($newLines) {
            $lineIds = Line::query()->pluck('id', 'key')->all();
        }

        $existingDirections = array_flip(LineDirection::query()->whereNotNull('external_id')->pluck('external_id')->all());
        $directions = [];
        $sequences = [];
        foreach ($entries as $entry) {
            $sequence = [];
            foreach ($entry['stops'] as $fileStopId) {
                if (! isset($stopIds[$fileStopId])) {
                    $report->anomaly("{$entry['name']} : arrêt {$fileStopId} absent de la liste des arrêts, ignoré.");

                    continue;
                }
                $sequence[] = $stopIds[$fileStopId];
            }

            // Un sens « partiel » n'a que ses terminus, voire rien : c'est attendu, pas une anomalie
            $partial = (bool) ($entry['partial'] ?? false);
            if (count($sequence) < 2 && ! $partial) {
                $report->anomaly("{$entry['name']} : moins de 2 arrêts, ce sens ne pourra pas servir à la recherche.");
            }
            if ($entry['_type'] === 'sotra' && empty($entry['ref'])) {
                $report->anomaly("{$entry['name']} : ligne SOTRA sans numéro.");
            }

            $externalId = self::externalId($entry['id']);
            isset($existingDirections[$externalId]) ? $report->directionsUpdated++ : $report->directionsCreated++;
            $sequences[$externalId] = $sequence;
            $directions[] = [
                'external_id' => $externalId,
                'osm_relation_id' => is_int($entry['id']) ? $entry['id'] : null,
                'line_id' => $lineIds[$entry['_key']],
                'name' => $entry['from'] && $entry['to'] ? "{$entry['from']} → {$entry['to']}" : $entry['name'],
                'origin_label' => $entry['from'] ?? null,
                'destination_label' => $entry['to'] ?? null,
                'is_loop' => count($sequence) > 1 && $sequence[0] === end($sequence),
                'is_partial' => $partial,
                'stops_count' => count($sequence),
                'geometry' => isset($entry['geometry']) ? json_encode($entry['geometry']) : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        $columns = ['line_id', 'osm_relation_id', 'name', 'origin_label', 'destination_label', 'is_loop', 'is_partial', 'stops_count', 'geometry', 'updated_at'];
        foreach (array_chunk($directions, 200) as $chunk) {
            LineDirection::query()->toBase()->upsert($chunk, ['external_id'], $columns);
        }

        $directionIds = [];
        foreach (array_chunk(array_keys($sequences), 1000) as $chunk) {
            $directionIds += LineDirection::query()->whereIn('external_id', $chunk)->pluck('id', 'external_id')->all();
        }
        foreach (array_chunk(array_values($directionIds), 1000) as $chunk) {
            DB::table('direction_stops')->whereIn('line_direction_id', $chunk)->delete();
        }
        $rows = [];
        foreach ($sequences as $externalId => $sequence) {
            foreach ($sequence as $i => $stopId) {
                $rows[] = ['line_direction_id' => $directionIds[$externalId], 'stop_id' => $stopId, 'sequence' => $i + 1];
            }
        }
        foreach (array_chunk($rows, 1000) as $chunk) {
            DB::table('direction_stops')->insert($chunk);
        }
    }

    /**
     * Ne touche qu'aux villes présentes dans le fichier : importer l'intérieur ne vide pas Abidjan.
     *
     * @param  list<array>  $entries
     */
    private function prune(array $entries, ImportReport $report): void
    {
        $cities = array_values(array_unique(array_map(fn ($entry) => $this->cityId($entry['city'] ?? null), $entries)));
        $report->directionsDeleted = LineDirection::query()
            ->whereHas('line', fn ($q) => $q->whereIn('city_id', $cities))
            ->whereNotIn('external_id', array_map(self::externalId(...), array_column($entries, 'id')))
            ->delete();
        $report->linesDeleted = Line::query()->whereIn('city_id', $cities)->whereDoesntHave('directions')->delete();
        $report->stopsDeleted = Stop::query()->whereIn('city_id', $cities)->whereDoesntHave('directions')->delete();
    }

    /**
     * Un entier est un id de relation OpenStreetMap ; une chaîne porte déjà sa source (« sotra-pdf:301:aller »).
     */
    public static function externalId(int|string $id): string
    {
        return is_int($id) ? "osm:{$id}" : $id;
    }

    /**
     * Les clés d'Abidjan restent celles d'avant l'arrivée des autres villes.
     */
    private function lineKey(string $type, array $entry): string
    {
        $city = $entry['city'] ?? City::DEFAULT;
        $key = $this->baseLineKey($type, $entry);

        return $city === City::DEFAULT ? $key : "{$city}:{$key}";
    }

    private function baseLineKey(string $type, array $entry): string
    {
        if ($type === 'sotra' && ! empty($entry['ref'])) {
            return 'sotra:'.(ltrim(Str::lower($entry['ref']), '0') ?: '0');
        }
        if (in_array($type, ['gbaka', 'woro-woro'], true) && $entry['from'] && $entry['to']) {
            $ends = [Str::slug($entry['from']), Str::slug($entry['to'])];
            sort($ends);

            return $type.':'.Str::slug($entry['category'] ?? '').':'.implode('|', $ends);
        }

        return $type.':'.self::externalId($entry['id']);
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

    /**
     * « Terminus Kennedy » existe à Abidjan et à Bouaké : hors d'Abidjan, le slug porte le nom de la ville.
     */
    private function withCity(string $source, ?string $city): string
    {
        return $city && $city !== City::DEFAULT ? "{$source} {$city}" : $source;
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

    /**
     * « Mosquée d'Adjamé » -> « mosquee d adjame »
     */
    public static function normalize(string $text): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', Str::lower(Str::ascii($text))));
    }

    private function stopKey(string $name, float|string $lat, float|string $lng): string
    {
        return sprintf('%s|%.6f|%.6f', $name, (float) $lat, (float) $lng);
    }
}
