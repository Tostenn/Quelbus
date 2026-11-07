<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['city_id', 'key', 'type', 'ref', 'name', 'slug', 'category', 'operator', 'fare', 'fare_type', 'accepts_student_card', 'fare_edited_at'])]
class Line extends Model
{
    public const TYPES = ['sotra', 'gbaka', 'woro-woro', 'autre'];

    /** Types de tarif du document SOTRA */
    public const FARE_TYPES = ['MONBUS', 'URBAIN', 'MARCHE', 'WIBUS', 'EXPRESS', 'NAVETTE', 'MONBATO'];

    protected function casts(): array
    {
        return [
            'fare' => 'integer',
            'accepts_student_card' => 'boolean',
            'fare_edited_at' => 'datetime',
        ];
    }

    /**
     * @return array{fare: ?int, fare_type: ?string, accepts_student_card: ?bool}
     */
    public function fareSummary(): array
    {
        return ['fare' => $this->fare, 'fare_type' => $this->fare_type, 'accepts_student_card' => $this->accepts_student_card];
    }

    /**
     * @return BelongsTo<City, $this>
     */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    /**
     * @return HasMany<LineDirection, $this>
     */
    public function directions(): HasMany
    {
        return $this->hasMany(LineDirection::class);
    }
}
