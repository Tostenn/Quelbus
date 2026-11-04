<?php

namespace App\Services;

use App\Models\Line;
use App\Models\Report;
use App\Models\SearchedRoute;
use App\Models\Stop;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Chiffres d'usage du tableau de bord, calculés depuis l'index des recherches.
 */
class Insights
{
    public const PERIODS = [7, 30, 90];

    private const TOP = 10;

    private Carbon $since;

    private Carbon $previous;

    public function __construct(private int $days)
    {
        $this->since = now()->subDays($days - 1)->startOfDay();
        $this->previous = $this->since->copy()->subDays($days);
    }

    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return [
            'days' => $this->days,
            'summary' => $this->summary(),
            'routes' => $this->topRoutes(),
            'departures' => $this->topStops('from_stop_id'),
            'destinations' => $this->topStops('to_stop_id'),
            'lines_proposed' => $this->linesProposed(),
            'lines_viewed' => $this->linesViewed(),
            'combinations' => $this->combinations(),
            'unanswered' => $this->unanswered(),
            'hours' => $this->byHour(),
            'weekdays' => $this->byWeekday(),
            'types' => $this->types(),
        ];
    }

    private function logs(): Builder
    {
        return DB::table('search_logs')->where('search_logs.created_at', '>=', $this->since);
    }

    /**
     * @return array<string, int|float|null>
     */
    private function summary(): array
    {
        $row = $this->logs()->selectRaw("
            count(*) as searches,
            count(*) filter (where outcome = 'direct') as direct,
            count(*) filter (where outcome = 'combination') as combination,
            count(*) filter (where outcome = 'walk') as walk,
            count(*) filter (where outcome = 'none') as none,
            count(*) filter (where from_gps) as gps,
            count(*) filter (where types is not null) as filtered,
            count(distinct searched_route_id) as routes
        ")->first();

        $searches = (int) $row->searches;
        $previous = DB::table('search_logs')->where('created_at', '>=', $this->previous)->where('created_at', '<', $this->since)->count();
        $visits = (int) DB::table('daily_stats')->where('date', '>=', $this->since->toDateString())->sum('visits');
        $reports = Report::query()->where('created_at', '>=', $this->since)->count();
        $share = fn (int $n) => $searches ? round($n / $searches * 100, 1) : null;

        return [
            'searches' => $searches,
            'previous_searches' => $previous,
            'growth' => $previous ? round(($searches - $previous) / $previous * 100, 1) : null,
            'direct' => (int) $row->direct,
            'combination' => (int) $row->combination,
            'walk' => (int) $row->walk,
            'none' => (int) $row->none,
            'answered_rate' => $share((int) $row->direct + (int) $row->combination + (int) $row->walk),
            'gps_rate' => $share((int) $row->gps),
            'filtered_rate' => $share((int) $row->filtered),
            'routes' => (int) $row->routes,
            'routes_indexed' => SearchedRoute::query()->count(),
            'routes_published' => SearchedRoute::query()->where('searches_count', '>=', SearchedRoute::SITEMAP_MIN_SEARCHES)->count(),
            'visits' => $visits,
            'searches_per_visit' => $visits ? round($searches / $visits, 2) : null,
            'reports' => $reports,
            'reports_per_1000' => $searches ? round($reports / $searches * 1000, 1) : null,
            'line_views' => (int) DB::table('line_views')->where('date', '>=', $this->since->toDateString())->sum('views'),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function topRoutes(): array
    {
        return $this->logs()
            ->join('searched_routes as r', 'r.id', '=', 'search_logs.searched_route_id')
            ->join('stops as f', 'f.id', '=', 'r.from_stop_id')
            ->join('stops as t', 't.id', '=', 'r.to_stop_id')
            // Clés primaires : PostgreSQL en déduit les autres colonnes (answer est en json, non groupable)
            ->groupBy('r.id', 'f.id', 't.id')
            ->orderByDesc('count')
            ->orderBy('r.id')
            ->limit(self::TOP)
            ->get(['r.slug', 'r.outcome', 'r.answer', 'f.name as from', 't.name as to', DB::raw('count(*) as count')])
            ->map(fn ($r) => [
                'slug' => $r->slug,
                'from' => $r->from,
                'to' => $r->to,
                'count' => (int) $r->count,
                'outcome' => $r->outcome,
                'options' => json_decode((string) $r->answer, true)['options'] ?? [],
            ])
            ->all();
    }

    /**
     * @return list<array{name: string, slug: string, count: int}>
     */
    private function topStops(string $column): array
    {
        return $this->logs()
            ->join('stops as s', 's.id', '=', "search_logs.{$column}")
            ->groupBy('s.id', 's.name', 's.slug')
            ->orderByDesc('count')
            ->orderBy('s.id')
            ->limit(self::TOP)
            ->get(['s.name', 's.slug', DB::raw('count(*) as count')])
            ->map(fn ($s) => ['name' => $s->name, 'slug' => $s->slug, 'count' => (int) $s->count])
            ->all();
    }

    /**
     * Lignes proposées dans les résultats ; « first » = proposée en premier.
     *
     * @return list<array<string, mixed>>
     */
    private function linesProposed(): array
    {
        return $this->logs()
            ->join('search_log_lines as sl', 'sl.search_log_id', '=', 'search_logs.id')
            ->join('lines as l', 'l.id', '=', 'sl.line_id')
            ->groupBy('l.id', 'l.ref', 'l.name', 'l.slug', 'l.type')
            ->orderByDesc('count')
            ->orderBy('l.id')
            ->limit(self::TOP)
            ->get([
                'l.ref', 'l.name', 'l.slug', 'l.type',
                DB::raw('count(distinct search_logs.id) as count'),
                DB::raw('count(distinct search_logs.id) filter (where sl.rank = 0) as first'),
            ])
            ->map(fn ($l) => [
                'line' => ['ref' => $l->ref, 'name' => $l->name, 'slug' => $l->slug, 'type' => $l->type],
                'count' => (int) $l->count,
                'first' => (int) $l->first,
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function linesViewed(): array
    {
        return DB::table('line_views as v')
            ->join('lines as l', 'l.id', '=', 'v.line_id')
            ->where('v.date', '>=', $this->since->toDateString())
            ->groupBy('l.id', 'l.ref', 'l.name', 'l.slug', 'l.type')
            ->orderByDesc('count')
            ->orderBy('l.id')
            ->limit(self::TOP)
            ->get(['l.ref', 'l.name', 'l.slug', 'l.type', DB::raw('sum(v.views) as count')])
            ->map(fn ($l) => [
                'line' => ['ref' => $l->ref, 'name' => $l->name, 'slug' => $l->slug, 'type' => $l->type],
                'count' => (int) $l->count,
            ])
            ->all();
    }

    /**
     * Enchaînements de lignes proposés en premier, quand il faut changer.
     *
     * @return list<array{lines: list<array>, count: int}>
     */
    private function combinations(): array
    {
        $rows = $this->logs()
            ->whereNotNull('combination')
            ->groupBy('combination')
            ->orderByDesc('count')
            ->orderBy('combination')
            ->limit(self::TOP)
            ->get(['combination', DB::raw('count(*) as count')]);

        $ids = $rows->flatMap(fn ($r) => explode('-', $r->combination))->unique()->map(fn ($id) => (int) $id);
        $lines = Line::query()->whereIn('id', $ids)->get(['id', 'ref', 'name', 'slug', 'type'])->keyBy('id');

        return $rows
            ->map(fn ($r) => [
                'lines' => collect(explode('-', $r->combination))
                    ->map(fn ($id) => $lines->get((int) $id)?->only(['ref', 'name', 'slug', 'type']))
                    ->filter()
                    ->values()
                    ->all(),
                'count' => (int) $r->count,
            ])
            ->filter(fn ($c) => count($c['lines']) > 1)
            ->values()
            ->all();
    }

    /**
     * Trajets demandés sans aucune réponse : là où les données manquent.
     *
     * @return list<array<string, mixed>>
     */
    private function unanswered(): array
    {
        $rows = $this->logs()
            ->where('outcome', 'none')
            ->groupBy('from_area', 'to_area')
            ->orderByDesc('count')
            ->orderBy('from_area')
            ->limit(self::TOP)
            ->get(['from_area', 'to_area', DB::raw('count(*) as count'), DB::raw('min(from_stop_id) as from_stop'), DB::raw('min(to_stop_id) as to_stop')]);

        $stops = Stop::query()->whereIn('id', $rows->flatMap(fn ($r) => [$r->from_stop, $r->to_stop])->filter())->pluck('name', 'id');
        $place = fn (string $area, ?int $stop) => [
            'area' => $area,
            'name' => $stop ? $stops->get($stop) : null,
        ];

        return $rows->map(fn ($r) => [
            'from' => $place($r->from_area, $r->from_stop),
            'to' => $place($r->to_area, $r->to_stop),
            'count' => (int) $r->count,
        ])->all();
    }

    /**
     * @return list<int> 24 valeurs, de 0 h à 23 h (heure d'Abidjan, UTC)
     */
    private function byHour(): array
    {
        $counts = $this->logs()
            ->selectRaw('extract(hour from created_at)::int as h, count(*) as count')
            ->groupBy('h')
            ->pluck('count', 'h');

        return array_map(fn ($h) => (int) ($counts[$h] ?? 0), range(0, 23));
    }

    /**
     * @return list<int> 7 valeurs, du lundi au dimanche
     */
    private function byWeekday(): array
    {
        $counts = $this->logs()
            ->selectRaw('extract(isodow from created_at)::int as d, count(*) as count')
            ->groupBy('d')
            ->pluck('count', 'd');

        return array_map(fn ($d) => (int) ($counts[$d] ?? 0), range(1, 7));
    }

    /**
     * @return list<array{types: string, count: int}>
     */
    private function types(): array
    {
        return $this->logs()
            ->whereNotNull('types')
            ->groupBy('types')
            ->orderByDesc('count')
            ->get(['types', DB::raw('count(*) as count')])
            ->map(fn ($t) => ['types' => $t->types, 'count' => (int) $t->count])
            ->all();
    }
}
