<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['line_id', 'external_id', 'osm_relation_id', 'name', 'origin_label', 'destination_label', 'is_loop', 'is_partial', 'stops_count', 'geometry', 'edited_at', 'edited_by'])]
class LineDirection extends Model
{
    protected function casts(): array
    {
        return [
            'is_loop' => 'boolean',
            'is_partial' => 'boolean',
            'geometry' => 'array',
            'edited_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Line, $this>
     */
    public function line(): BelongsTo
    {
        return $this->belongsTo(Line::class);
    }

    /**
     * @return BelongsToMany<Stop, $this>
     */
    public function stops(): BelongsToMany
    {
        return $this->belongsToMany(Stop::class, 'direction_stops')
            ->withPivot('sequence')
            ->orderByPivot('sequence');
    }
}
