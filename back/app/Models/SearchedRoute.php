<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['from_stop_id', 'to_stop_id', 'slug', 'searches_count', 'outcome', 'answer', 'last_searched_at'])]
class SearchedRoute extends Model
{
    /** Recherches nécessaires pour qu'un trajet entre dans le sitemap. */
    public const SITEMAP_MIN_SEARCHES = 3;

    protected function casts(): array
    {
        return [
            'answer' => 'array',
            'searches_count' => 'integer',
            'last_searched_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Stop, $this>
     */
    public function from(): BelongsTo
    {
        return $this->belongsTo(Stop::class, 'from_stop_id');
    }

    /**
     * @return BelongsTo<Stop, $this>
     */
    public function to(): BelongsTo
    {
        return $this->belongsTo(Stop::class, 'to_stop_id');
    }
}
