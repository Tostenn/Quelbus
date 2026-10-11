<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['reference', 'amount', 'currency', 'status', 'name', 'email', 'message', 'channel', 'paid_at'])]
class Donation extends Model
{
    public const MIN_AMOUNT = 200;

    public const MAX_AMOUNT = 1000000;

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }
}
