<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Historique des modifications du réseau faites dans le tableau de bord.
 */
#[Fillable(['user_id', 'subject_type', 'subject_id', 'field', 'before', 'after'])]
class TransitChange extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array'];
    }

    public static function record(?User $user, Model $subject, string $field, mixed $before, mixed $after): void
    {
        if ($before === $after) {
            return;
        }
        self::query()->create([
            'user_id' => $user?->id,
            'subject_type' => $subject instanceof Line ? 'line' : 'direction',
            'subject_id' => $subject->getKey(),
            'field' => $field,
            'before' => $before,
            'after' => $after,
        ]);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
