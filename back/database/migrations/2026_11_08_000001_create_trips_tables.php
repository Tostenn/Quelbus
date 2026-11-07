<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Voyages partagés par les usagers (« Je suis dans le bus ») : position des bus en direct,
 * et passages aux arrêts qui nourriront la prédiction (lot 4).
 *
 * Vie privée (VISION.md) : un voyage est anonyme (identifiant au hasard, aucun lien avec un compte),
 * on garde des passages aux arrêts, et les points GPS bruts sont effacés vite (voir transit:trips-cleanup).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('line_direction_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64); // sha256 du jeton remis au téléphone, seul à pouvoir envoyer des positions
            $table->string('client', 10)->default('web'); // web, app
            $table->string('status', 12)->default('active'); // active, ended, off_route
            $table->boolean('complete')->default(false); // arrivé au terminus
            // Dernière position, ramenée sur le tracé de la ligne
            $table->unsignedInteger('progress_m')->default(0);
            $table->decimal('lat', 9, 6)->nullable();
            $table->decimal('lng', 9, 6)->nullable();
            $table->unsignedSmallInteger('last_sequence')->nullable(); // dernier arrêt passé
            $table->timestamp('last_point_at')->nullable(); // heure GPS du dernier point accepté
            $table->unsignedSmallInteger('points_count')->default(0);
            $table->unsignedSmallInteger('rejected_count')->default(0);
            $table->unsignedSmallInteger('off_route_streak')->default(0);
            $table->json('state')->nullable(); // arrêt en cours d'approche (calcul du temps passé à l'arrêt)
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'last_point_at']);
        });

        Schema::create('stop_passages', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('line_direction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stop_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sequence');
            $table->timestamp('passed_at');
            $table->unsignedSmallInteger('dwell_seconds')->nullable(); // temps passé à l'arrêt
            $table->unsignedSmallInteger('accuracy_m')->nullable();

            $table->unique(['trip_id', 'sequence']);
            $table->index(['line_direction_id', 'sequence', 'passed_at']);
        });

        // Points GPS bruts : quelques heures seulement (plus longtemps pour les lignes sans tracé, afin de le dessiner)
        Schema::create('trip_points', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('trip_id')->constrained()->cascadeOnDelete();
            $table->decimal('lat', 9, 6);
            $table->decimal('lng', 9, 6);
            $table->unsignedSmallInteger('accuracy_m')->nullable();
            $table->unsignedInteger('progress_m')->nullable();
            $table->timestamp('recorded_at');

            $table->index(['trip_id', 'recorded_at']);
            $table->index('recorded_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trip_points');
        Schema::dropIfExists('stop_passages');
        Schema::dropIfExists('trips');
    }
};
