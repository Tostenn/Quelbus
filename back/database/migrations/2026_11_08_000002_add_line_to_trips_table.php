<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * « Je suis dans ce bus » sans choisir le sens : le voyage démarre avec la ligne seule,
 * le sens est déduit des premiers points (dans quel sens l'avancement augmente).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->foreignId('line_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('line_direction_id')->nullable()->change();
        });
        DB::table('trips')->update([
            'line_id' => DB::raw('(select line_id from line_directions where line_directions.id = trips.line_direction_id)'),
        ]);
    }

    public function down(): void
    {
        DB::table('trips')->whereNull('line_direction_id')->delete();
        Schema::table('trips', function (Blueprint $table) {
            $table->dropConstrainedForeignId('line_id');
            $table->unsignedBigInteger('line_direction_id')->nullable(false)->change();
        });
    }
};
