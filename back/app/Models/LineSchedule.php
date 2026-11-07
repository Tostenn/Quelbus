<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Plage de service d'un sens de ligne : premier et dernier départ au terminus, pour un type de jour.
 */
#[Fillable(['line_direction_id', 'day_type', 'first_departure', 'last_departure', 'source', 'source_url', 'observed_on', 'user_id'])]
class LineSchedule extends Model
{
    /** « tous » : la source ne distingue pas les jours. */
    public const DAY_TYPES = ['tous', 'semaine', 'samedi', 'dimanche'];

    protected function casts(): array
    {
        return ['observed_on' => 'date'];
    }

    /**
     * @return BelongsTo<LineDirection, $this>
     */
    public function direction(): BelongsTo
    {
        return $this->belongsTo(LineDirection::class, 'line_direction_id');
    }

    /**
     * @return array{day_type: string, first_departure: string, last_departure: string, source: ?string, source_url: ?string, observed_on: ?string}
     */
    public function summary(): array
    {
        return [
            'day_type' => $this->day_type,
            'first_departure' => substr($this->first_departure, 0, 5),
            'last_departure' => substr($this->last_departure, 0, 5),
            'source' => $this->source,
            'source_url' => $this->source_url,
            'observed_on' => $this->observed_on?->toDateString(),
        ];
    }
}
