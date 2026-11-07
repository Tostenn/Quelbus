<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un voyage partagé par un usager à bord d'un bus. Anonyme : l'identifiant est tiré au hasard
 * et seul le téléphone qui a reçu le jeton peut y envoyer des positions.
 */
#[Fillable([
    'line_direction_id', 'token_hash', 'client', 'status', 'complete', 'progress_m', 'lat', 'lng', 'last_sequence',
    'last_point_at', 'points_count', 'rejected_count', 'off_route_streak', 'state', 'started_at', 'ended_at',
])]
class Trip extends Model
{
    use HasUuids;

    public const ACTIVE = 'active';

    public const ENDED = 'ended';

    /** La trace ne suit pas la ligne : l'usager n'est sans doute pas dans ce bus */
    public const OFF_ROUTE = 'off_route';

    protected function casts(): array
    {
        return [
            'complete' => 'boolean',
            'lat' => 'float',
            'lng' => 'float',
            'state' => 'array',
            'last_point_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function checkToken(?string $token): bool
    {
        return is_string($token) && hash_equals($this->token_hash, hash('sha256', $token));
    }

    /**
     * @return BelongsTo<LineDirection, $this>
     */
    public function direction(): BelongsTo
    {
        return $this->belongsTo(LineDirection::class, 'line_direction_id');
    }

    /**
     * @return HasMany<StopPassage, $this>
     */
    public function passages(): HasMany
    {
        return $this->hasMany(StopPassage::class);
    }

    /**
     * @return HasMany<TripPoint, $this>
     */
    public function points(): HasMany
    {
        return $this->hasMany(TripPoint::class);
    }
}
