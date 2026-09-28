<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['first_name', 'last_name', 'email', 'profile', 'message'])]
class Subscriber extends Model
{
    /**
     * Profils possibles : personne qui utilisera l'app, qui veut contribuer, ou les deux.
     */
    public const PROFILES = ['utilisateur', 'contributeur', 'les_deux'];
}
