<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['page', 'line_id', 'stop_id', 'kind', 'message', 'email'])]
class Report extends Model
{
    public const KINDS = [
        'arret_manquant' => 'Arrêt manquant',
        'arret_mal_place' => 'Arrêt mal placé ou mal nommé',
        'ordre_faux' => 'Ordre des arrêts faux',
        'ligne_ne_passe_plus' => 'La ligne ne passe plus par là',
        'ligne_manquante' => 'Ligne manquante',
        'autre' => 'Autre',
    ];
}
