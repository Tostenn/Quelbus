<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'search_name', 'slug', 'lat', 'lng', 'commune'])]
class Stop extends Model
{
    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
        ];
    }

    /**
     * @return BelongsToMany<LineDirection, $this>
     */
    public function directions(): BelongsToMany
    {
        return $this->belongsToMany(LineDirection::class, 'direction_stops')->withPivot('sequence');
    }
}
