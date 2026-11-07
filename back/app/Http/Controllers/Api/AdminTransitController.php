<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LineDirection;
use App\Services\Transit\DirectionEditor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Validator;

/**
 * Édition du réseau depuis le tableau de bord.
 */
class AdminTransitController extends Controller
{
    /** Marge autour de l'emprise de la ville, en degrés (≈ 5 km) : les terminus sont parfois en bordure. */
    private const BOUNDS_MARGIN = 0.05;

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
