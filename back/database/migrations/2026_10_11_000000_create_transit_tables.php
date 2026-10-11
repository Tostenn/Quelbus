<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Réseau de transport : une ligne a un ou plusieurs sens,
     * chaque sens dessert une suite ordonnée d'arrêts.
     */
    public function up(): void
    {
        Schema::create('lines', function (Blueprint $table) {
            $table->id();
            // Clé de regroupement calculée à l'import (ex. « sotra:201 »), pour rester idempotent
            $table->string('key')->unique();
            $table->string('type', 20)->index(); // sotra, gbaka, woro-woro, autre
            $table->string('ref', 20)->nullable()->index(); // numéro SOTRA, null pour gbaka et woro-woro
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('category')->nullable(); // catégorie de la source : monbus, Gbaka d'Adjamé…
            $table->string('operator')->nullable();
            $table->timestamps();
        });

        Schema::create('line_directions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('line_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('osm_relation_id')->unique();
            $table->string('name');
            $table->string('origin_label')->nullable();
            $table->string('destination_label')->nullable();
            $table->boolean('is_loop')->default(false);
            $table->unsignedSmallInteger('stops_count')->default(0);
            $table->json('geometry')->nullable(); // segments de [lat, lng]
            $table->timestamps();
        });

        Schema::create('stops', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('search_name')->index(); // nom en minuscules sans accents, pour l'autocomplétion
            $table->string('slug')->unique();
            $table->decimal('lat', 9, 6);
            $table->decimal('lng', 9, 6);
            $table->string('commune')->nullable();
            $table->timestamps();

            // La source ne fournit pas d'identifiant d'arrêt : un arrêt = un nom à une position
            $table->unique(['name', 'lat', 'lng']);
            $table->index(['lat', 'lng']);
        });

        Schema::create('direction_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('line_direction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stop_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sequence');

            $table->unique(['line_direction_id', 'sequence']);
            $table->index('stop_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('direction_stops');
        Schema::dropIfExists('stops');
        Schema::dropIfExists('line_directions');
        Schema::dropIfExists('lines');
    }
};
