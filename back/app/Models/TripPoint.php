<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Point GPS brut d'un voyage. Effacé au bout de quelques heures (voir transit:trips-cleanup).
 */
#[Fillable(['trip_id', 'lat', 'lng', 'accuracy_m', 'progress_m', 'recorded_at'])]
class TripPoint extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['lat' => 'float', 'lng' => 'float', 'recorded_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<Trip, $this>
     */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }
}
