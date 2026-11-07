<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Line;
use App\Models\LineDirection;
use App\Models\LineSchedule;
use App\Models\TransitChange;
use App\Services\Transit\DirectionEditor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Édition du réseau depuis le tableau de bord.
 */
class AdminTransitController extends Controller
{
    /** Marge autour de l'emprise de la ville, en degrés (≈ 5 km) : les terminus sont parfois en bordure. */
    private const BOUNDS_MARGIN = 0.05;

    public function updateFare(Request $request, Line $line): JsonResponse
    {
        $data = $request->validate([
            'fare' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'fare_type' => ['nullable', Rule::in(Line::FARE_TYPES)],
            'accepts_student_card' => ['nullable', 'boolean'],
        ], [
            'fare.integer' => 'Le tarif est un nombre entier de francs CFA.',
            'fare.max' => 'Le tarif semble trop élevé.',
        ]);

        $before = $line->fareSummary();
        $line->update([...$data, 'fare_edited_at' => now()]);
        TransitChange::record($request->user(), $line, 'fare', $before, $line->fareSummary());

        return response()->json(['message' => 'Tarif enregistré.', 'data' => $line->fareSummary()]);
    }

    /**
     * Remplace toutes les plages de service du sens : au plus une par type de jour.
     */
    public function updateSchedules(Request $request, LineDirection $direction): JsonResponse
    {
        $data = $request->validate([
            'schedules' => ['present', 'array', 'max:4'],
            'schedules.*.day_type' => ['required', 'distinct', Rule::in(LineSchedule::DAY_TYPES)],
            'schedules.*.first_departure' => ['required', 'date_format:H:i'],
            'schedules.*.last_departure' => ['required', 'date_format:H:i'],
            'schedules.*.source' => ['nullable', 'string', 'max:255'],
            'schedules.*.source_url' => ['nullable', 'url', 'max:500'],
            'schedules.*.observed_on' => ['nullable', 'date', 'before_or_equal:today'],
        ], [
            'schedules.*.day_type.distinct' => 'Un seul horaire par type de jour.',
            'schedules.*.first_departure.date_format' => 'Heure au format 05:30.',
            'schedules.*.last_departure.date_format' => 'Heure au format 21:45.',
        ]);

        $before = $direction->schedules->map->summary()->all();
        DB::transaction(function () use ($direction, $data, $request) {
            $direction->schedules()->delete();
            foreach ($data['schedules'] as $schedule) {
                $direction->schedules()->create([...$schedule, 'user_id' => $request->user()->id]);
            }
        });
        $after = $direction->schedules()->get()->map->summary()->all();
        TransitChange::record($request->user(), $direction, 'schedules', $before, $after);

        return response()->json(['message' => 'Horaires enregistrés.', 'data' => $after]);
    }

    /**
     * Les dernières modifications d'une ligne et de ses sens.
     */
    public function changes(Line $line): JsonResponse
    {
        $directions = $line->directions()->pluck('name', 'id');
        $changes = TransitChange::query()
            ->with('user:id,name')
            ->where(fn ($q) => $q->where(['subject_type' => 'line', 'subject_id' => $line->id])
                ->orWhere(fn ($q) => $q->where('subject_type', 'direction')->whereIn('subject_id', $directions->keys())))
            ->latest('id')
            ->limit(30)
            ->get()
            ->map(fn (TransitChange $change) => [
                'id' => $change->id,
                'field' => $change->field,
                'direction' => $change->subject_type === 'direction' ? $directions[$change->subject_id] ?? null : null,
                'user' => $change->user?->name,
                'before' => $change->before,
                'after' => $change->after,
                'created_at' => $change->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $changes]);
    }

    public function updateStops(Request $request, LineDirection $direction, DirectionEditor $editor): JsonResponse
    {
        $direction->load('line.city');
        $city = $direction->line->city;

        $data = $request->validate([
            'stops' => ['present', 'array', 'max:300'],
            'stops.*.id' => ['nullable', 'integer', 'exists:stops,id'],
            'stops.*.name' => ['required', 'string', 'min:2', 'max:120'],
            'stops.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'stops.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'complete' => ['required', 'boolean'],
        ], [
            'stops.*.name.required' => 'Chaque arrêt doit avoir un nom.',
            'stops.*.name.min' => 'Le nom d’un arrêt fait au moins 2 caractères.',
        ]);
        // validate() reconstruit le tableau règle par règle : les arrêts avec « id » passeraient devant les autres
        ksort($data['stops']);

        if ($city) {
            validator($data)->after(function (Validator $validator) use ($data, $city) {
                foreach ($data['stops'] as $i => $stop) {
                    $inside = $stop['lat'] >= $city->min_lat - self::BOUNDS_MARGIN && $stop['lat'] <= $city->max_lat + self::BOUNDS_MARGIN
                        && $stop['lng'] >= $city->min_lng - self::BOUNDS_MARGIN && $stop['lng'] <= $city->max_lng + self::BOUNDS_MARGIN;
                    if (! $inside) {
                        $validator->errors()->add("stops.{$i}.lat", "« {$stop['name']} » est hors de {$city->name}.");
                    }
                }
            })->validate();
        }

        $direction = $editor->save($direction, $data['stops'], $data['complete'], $request->user());

        return response()->json([
            'message' => "Arrêts enregistrés : {$direction->stops_count} arrêt".($direction->stops_count > 1 ? 's' : '').'.',
            'data' => ['id' => $direction->id, 'stops_count' => $direction->stops_count, 'is_partial' => $direction->is_partial],
        ]);
    }
}
