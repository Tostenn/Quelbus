<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Line;
use App\Models\Report;
use App\Models\Stop;
use App\Models\Subscriber;
use App\Services\Insights;
use App\Services\Stats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function stats(): JsonResponse
    {
        $rows = DB::table('daily_stats')
            ->where('date', '>=', now()->subDays(29)->toDateString())
            ->get(['date', 'visits', 'searches'])
            ->keyBy(fn ($row) => substr((string) $row->date, 0, 10));

        $days = [];
        for ($i = 29; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $days[] = [
                'date' => $date,
                'visits' => (int) ($rows[$date]->visits ?? 0),
                'searches' => (int) ($rows[$date]->searches ?? 0),
            ];
        }

        return response()->json(['data' => [
            'totals' => [
                ...Stats::totals(),
                'reports' => Report::count(),
                'subscribers' => Subscriber::count(),
                'lines' => Line::count(),
                'stops' => Stop::count(),
            ],
            'days' => $days,
        ]]);
    }

    /**
     * Usage de l'appli sur 7, 30 ou 90 jours : trajets, lignes, combinaisons, réponses manquantes.
     */
    public function insights(Request $request): JsonResponse
    {
        $days = (int) $request->query('jours', 30);

        return response()->json(['data' => (new Insights(in_array($days, Insights::PERIODS, true) ? $days : 30))->all()]);
    }

    public function reports(): JsonResponse
    {
        $reports = Report::query()
            ->leftJoin('lines', 'lines.id', '=', 'reports.line_id')
            ->leftJoin('stops', 'stops.id', '=', 'reports.stop_id')
            ->orderByDesc('reports.id')
            ->select([
                'reports.id', 'reports.kind', 'reports.message', 'reports.email', 'reports.page', 'reports.created_at',
                'lines.ref as line_ref', 'lines.name as line_name', 'stops.name as stop_name',
            ])
            ->paginate(20);

        $reports->getCollection()->transform(fn (Report $r) => [
            ...$r->toArray(),
            'kind_label' => Report::KINDS[$r->kind] ?? $r->kind,
        ]);

        return response()->json($reports);
    }

    public function subscribers(): JsonResponse
    {
        return response()->json(
            Subscriber::query()
                ->orderByDesc('id')
                ->paginate(20, ['id', 'first_name', 'last_name', 'email', 'profile', 'message', 'created_at', 'unsubscribed_at']),
        );
    }
}
