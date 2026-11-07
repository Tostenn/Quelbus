<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Line;
use App\Models\LineDirection;
use App\Models\Trip;
use App\Services\Live\LiveBuses;
use App\Services\Live\TripTracker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * « Je suis dans le bus » : le site et l'app mobile envoient la position de l'usager pendant le trajet.
 *
 *   POST /api/trips                    { line_direction_id, client }  -> { id, token }
 *   POST /api/trips/{id}/positions     { points: [{ lat, lng, accuracy, t }] }  (en-tête X-Trip-Token)
 *   POST /api/trips/{id}/end           (en-tête X-Trip-Token)
 *   GET  /api/lines/{slug}/live        bus de la ligne en ce moment
 *
 * Les points s'envoient par lots (jusqu'à 120) : l'app peut les garder pendant une coupure réseau
 * et tout renvoyer ensuite, les doublons sont ignorés.
 */
class TripController extends Controller
{
    public function start(Request $request, TripTracker $tracker): JsonResponse
    {
        $data = $request->validate([
            'line_direction_id' => ['required', 'integer', 'exists:line_directions,id'],
            'client' => ['nullable', Rule::in(['web', 'app'])],
        ]);

        $direction = LineDirection::query()->findOrFail($data['line_direction_id']);
        ['trip' => $trip, 'token' => $token] = $tracker->start($direction, $data['client'] ?? 'web');

        return response()->json(['data' => ['id' => $trip->id, 'token' => $token, ...$this->present($trip)]], 201);
    }

    public function positions(Request $request, Trip $trip, TripTracker $tracker): JsonResponse
    {
        abort_unless($trip->checkToken($request->header('X-Trip-Token')), 403, 'Jeton de voyage invalide.');

        $data = $request->validate([
            'points' => ['required', 'array', 'min:1', 'max:120'],
            'points.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'points.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'points.*.accuracy' => ['nullable', 'numeric', 'min:0'],
            'points.*.t' => ['required', 'integer', 'min:0'],
        ]);

        $result = $tracker->ingest($trip, array_values($data['points']));

        return response()->json(['data' => [...$this->present($trip->refresh()), ...$result]]);
    }

    public function end(Request $request, Trip $trip, TripTracker $tracker): JsonResponse
    {
        abort_unless($trip->checkToken($request->header('X-Trip-Token')), 403, 'Jeton de voyage invalide.');
        $tracker->end($trip);

        return response()->json(['data' => $this->present($trip->refresh())]);
    }

    public function live(Line $line, LiveBuses $live): JsonResponse
    {
        return response()->json([
            'data' => $live->forLine($line),
            'fresh_seconds' => LiveBuses::FRESH_SECONDS,
        ]);
    }

    /**
     * @return array{status: string, complete: bool, progress_m: int, last_sequence: ?int}
     */
    private function present(Trip $trip): array
    {
        return [
            'status' => $trip->status,
            'complete' => $trip->complete,
            'progress_m' => $trip->progress_m,
            'last_sequence' => $trip->last_sequence,
        ];
    }
}
