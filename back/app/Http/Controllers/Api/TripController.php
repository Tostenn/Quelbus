<?php

namespace App\Http\Controllers\Api;

use App\Events\BusesUpdated;
use App\Http\Controllers\Controller;
use App\Models\Line;
use App\Models\LineDirection;
use App\Models\Trip;
use App\Services\Live\LiveBuses;
use App\Services\Live\TripTracker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * « Je suis dans le bus » : le site et l'app mobile envoient la position de l'usager pendant le trajet.
 *
 *   POST /api/trips                    { line_direction_id | line_id, client }  -> { id, token }
 *                                      avec line_id seul, le sens est déduit des premiers points
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
            'line_direction_id' => ['required_without:line_id', 'nullable', 'integer', 'exists:line_directions,id'],
            'line_id' => ['required_without:line_direction_id', 'nullable', 'integer', 'exists:lines,id'],
            'client' => ['nullable', Rule::in(['web', 'app'])],
        ]);

        $direction = isset($data['line_direction_id']) ? LineDirection::query()->findOrFail($data['line_direction_id']) : null;
        $line = $direction?->line ?? Line::query()->findOrFail($data['line_id']);
        ['trip' => $trip, 'token' => $token] = $tracker->start($line, $direction, $data['client'] ?? 'web');

        return response()->json(['data' => ['id' => $trip->id, 'token' => $token, ...$this->present($trip)]], 201);
    }

    public function positions(Request $request, Trip $trip, TripTracker $tracker, LiveBuses $live): JsonResponse
    {
        abort_unless($trip->checkToken($request->header('X-Trip-Token')), 403, 'Jeton de voyage invalide.');

        $data = $request->validate([
            'points' => ['required', 'array', 'min:1', 'max:120'],
            'points.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'points.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'points.*.accuracy' => ['nullable', 'numeric', 'min:0'],
            'points.*.t' => ['required', 'integer', 'min:0'],
        ]);

        $status = $trip->status;
        $result = $tracker->ingest($trip, array_values($data['points']));
        $trip->refresh();
        if ($result['accepted'] > 0 || $trip->status !== $status) {
            $this->broadcast($trip, $live);
        }

        return response()->json(['data' => [...$this->present($trip), ...$result]]);
    }

    public function end(Request $request, Trip $trip, TripTracker $tracker, LiveBuses $live): JsonResponse
    {
        abort_unless($trip->checkToken($request->header('X-Trip-Token')), 403, 'Jeton de voyage invalide.');
        $tracker->end($trip);
        $this->broadcast($trip, $live);

        return response()->json(['data' => $this->present($trip->refresh())]);
    }

    /**
     * Tous les bus en direct, toutes lignes confondues (page « En direct »).
     */
    public function all(LiveBuses $live): JsonResponse
    {
        return response()->json(['data' => $live->all(), 'fresh_seconds' => LiveBuses::FRESH_SECONDS]);
    }

    /**
     * Pousse les bus de la ligne aux pages ouvertes. Une panne de Pusher ne doit pas faire échouer l'envoi des positions.
     */
    private function broadcast(Trip $trip, LiveBuses $live): void
    {
        if (! $trip->line) {
            return;
        }
        try {
            BusesUpdated::dispatch($trip->line_id, $live->all($trip->line));
        } catch (Throwable $e) {
            Log::warning('Diffusion des bus en direct impossible : '.$e->getMessage());
        }
    }

    public function live(Line $line, LiveBuses $live): JsonResponse
    {
        return response()->json([
            'data' => $live->forLine($line),
            'fresh_seconds' => LiveBuses::FRESH_SECONDS,
        ]);
    }

    /**
     * @return array{line_direction_id: ?int, status: string, complete: bool, progress_m: int, last_sequence: ?int}
     */
    private function present(Trip $trip): array
    {
        return [
            'line_direction_id' => $trip->line_direction_id,
            'status' => $trip->status,
            'complete' => $trip->complete,
            'progress_m' => $trip->progress_m,
            'last_sequence' => $trip->last_sequence,
        ];
    }
}
