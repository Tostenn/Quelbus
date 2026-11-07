<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Passage d'un bus à un arrêt, relevé pendant un voyage partagé : la matière première de la prédiction.
 */
#[Fillable(['trip_id', 'line_direction_id', 'stop_id', 'sequence', 'passed_at', 'dwell_seconds', 'accuracy_m'])]
class StopPassage extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['passed_at' => 'datetime'];
    }
}
