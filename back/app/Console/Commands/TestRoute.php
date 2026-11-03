<?php

namespace App\Console\Commands;

use App\Services\Transit\RouteSearchService;
use App\Services\Transit\StopSuggester;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Pour vérifier les propositions sur les vraies données, ex. :
 *   php artisan transit:route "Yopougon Siporex" "Cocody Centre"
 *   php artisan transit:route 5.3405,-4.0905 5.3515,-3.99 --types=sotra
 */
#[Signature('transit:route {from : Nom d’arrêt ou « lat,lng »} {to : Nom d’arrêt ou « lat,lng »} {--radius=300 : Marche max (300, 500, 800)} {--types= : sotra,gbaka,woro-woro}')]
#[Description('Affiche les lignes directes et les combinaisons proposées entre deux lieux')]
class TestRoute extends Command
{
    public function handle(RouteSearchService $search, StopSuggester $suggester): int
    {
        $from = $this->place($this->argument('from'), $suggester);
        $to = $this->place($this->argument('to'), $suggester);
        if (! $from || ! $to) {
            return self::FAILURE;
        }
        $types = $this->option('types') ? explode(',', $this->option('types')) : null;

        $this->line("De <info>{$from['name']}</info> à <info>{$to['name']}</info>");
        $start = microtime(true);
        $result = $search->search($from['lat'], $from['lng'], $to['lat'], $to['lng'], (int) $this->option('radius'), $types);
        $ms = (int) round((microtime(true) - $start) * 1000);
        $this->line("Distance à vol d'oiseau : {$result['distance']} m · calcul : {$ms} ms\n");

        $this->info(count($result['results']).' ligne(s) directe(s)'.($result['expanded'] ? " (marche élargie à {$result['radius']} m)" : ''));
        foreach (array_slice($result['results'], 0, 5) as $r) {
            $this->line("  • {$this->label($r['line'])} : {$r['board']['name']} → {$r['alight']['name']} ({$r['stops']} arrêts, {$r['walk']} m à pied)");
        }

        $this->newLine();
        $this->info(count($result['combinations']).' combinaison(s)'.($result['combinations'] ? " · affichées en premier : {$result['prefer']}" : ''));
        foreach ($result['combinations'] as $n => $c) {
            $this->line(sprintf('  %d. %s — %d changement(s), %d m à pied, %d arrêts, score %d',
                $n + 1, implode(' + ', array_map(fn ($leg) => $this->label($leg['line']), $c['legs'])), $c['changes'], $c['walk'], $c['stops'], $c['score']));
            foreach ($c['legs'] as $k => $leg) {
                $walk = $leg['board']['walk'] ? " (après {$leg['board']['walk']} m à pied)" : '';
                $hub = $k > 0 ? " · {$leg['lines_here']} lignes à ce changement" : '';
                $this->line("       {$this->label($leg['line'])} {$leg['direction']['name']} : montez à {$leg['board']['name']}{$walk}, descendez à {$leg['alight']['name']} ({$leg['stops']} arrêts){$hub}");
            }
        }

        return self::SUCCESS;
    }

    private function label(array $line): string
    {
        return $line['ref'] ? "{$line['type']} {$line['ref']}" : "{$line['type']} « {$line['name']} »";
    }

    /** @return array{name: string, lat: float, lng: float}|null */
    private function place(string $input, StopSuggester $suggester): ?array
    {
        if (preg_match('/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/', $input, $m)) {
            return ['name' => $input, 'lat' => (float) $m[1], 'lng' => (float) $m[2]];
        }
        $found = $suggester->suggest($input, 1)[0] ?? null;
        if (! $found) {
            $this->error("Aucun arrêt ne correspond à « {$input} ».");
        }

        return $found;
    }
}
