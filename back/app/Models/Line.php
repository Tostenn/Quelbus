<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['city_id', 'key', 'type', 'ref', 'name', 'slug', 'category', 'operator'])]
class Line extends Model
{
    public const TYPES = ['sotra', 'gbaka', 'woro-woro', 'autre'];

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
