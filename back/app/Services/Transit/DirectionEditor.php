<?php

namespace App\Services\Transit;

use App\Models\LineDirection;
use App\Models\Stop;
use App\Models\TransitChange;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Saisie des arrêts d'un sens dans le tableau de bord : surtout pour les villes de l'intérieur,
 * dont on ne connaît au départ que les terminus.
 *
 * Un arrêt existant peut être renommé ou déplacé : il change alors pour toutes les lignes qui y passent.
 * Aucun arrêt n'est supprimé (recherches et signalements y sont rattachés) ; un arrêt retiré
 * de toutes les lignes disparaîtra au prochain import avec --prune.
 */
class DirectionEditor
{
    /**
     * @param  list<array{id?: ?int, name: string, lat: float, lng: float}>  $items  dans l'ordre du trajet
     */
    public function save(LineDirection $direction, array $items, bool $complete, User $editor): LineDirection
    {
        return DB::transaction(function () use ($direction, $items, $complete, $editor) {
            $cityId = $direction->line->city_id;
            $before = $direction->stops->map(fn (Stop $s) => $s->only(['id', 'name', 'lat', 'lng']))->all();
            $sequence = [];

            foreach ($items as $item) {
                $name = trim($item['name']);
                $lat = round((float) $item['lat'], 6);
                $lng = round((float) $item['lng'], 6);

                $stop = isset($item['id']) ? Stop::query()->find($item['id']) : null;
                // Même nom, même position : c'est le même arrêt (contrainte d'unicité)
                $twin = Stop::query()->where(['name' => $name, 'lat' => $lat, 'lng' => $lng])->first();

                if ($twin && $twin->id !== $stop?->id) {
                    $stop = $twin;
                } elseif ($stop) {
                    $stop->fill(['name' => $name, 'search_name' => TransitImporter::normalize($name), 'lat' => $lat, 'lng' => $lng]);
                    $stop->save();
                } else {
                    $stop = Stop::query()->create([
                        'city_id' => $cityId,
                        'name' => $name,
                        'search_name' => TransitImporter::normalize($name),
                        'slug' => $this->uniqueSlug($name, $direction),
                        'lat' => $lat,
                        'lng' => $lng,
                    ]);
                }
                $sequence[] = $stop->id;
            }

            DB::table('direction_stops')->where('line_direction_id', $direction->id)->delete();
            DB::table('direction_stops')->insert(array_map(
                fn (int $stopId, int $i) => ['line_direction_id' => $direction->id, 'stop_id' => $stopId, 'sequence' => $i + 1],
                $sequence,
                array_keys($sequence),
            ));

            $direction->fill([
                'stops_count' => count($sequence),
                'is_loop' => count($sequence) > 1 && $sequence[0] === end($sequence),
                'is_partial' => ! $complete,
                'edited_at' => now(),
                'edited_by' => $editor->id,
            ])->save();

            $direction->refresh();
            TransitChange::record($editor, $direction, 'stops', $before, $direction->stops->map(fn (Stop $s) => $s->only(['id', 'name', 'lat', 'lng']))->all());

            return $direction;
        });
    }

    private function uniqueSlug(string $name, LineDirection $direction): string
    {
        $city = $direction->line->city?->slug;
        $base = Str::slug($city && $city !== 'abidjan' ? "{$name} {$city}" : $name) ?: 'arret';
        $slug = $base;
        for ($i = 2; Stop::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
