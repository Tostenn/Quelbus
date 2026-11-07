<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['slug', 'name', 'min_lat', 'min_lng', 'max_lat', 'max_lng', 'position'])]
class City extends Model
{
    public const DEFAULT = 'abidjan';

    protected function casts(): array
    {
        return [
            'min_lat' => 'float',
            'min_lng' => 'float',
            'max_lat' => 'float',
            'max_lng' => 'float',
            'position' => 'integer',
        ];
    }

    /**
     * @return HasMany<Line, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(Line::class);
    }

    /**
     * @return HasMany<Stop, $this>
     */
    public function stops(): HasMany
    {
        return $this->hasMany(Stop::class);
    }

    /**
     * @return array{slug: string, name: string, bounds: array{float, float, float, float}}
     */
    public function summary(): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'bounds' => [$this->min_lat, $this->min_lng, $this->max_lat, $this->max_lng],
        ];
    }
}
