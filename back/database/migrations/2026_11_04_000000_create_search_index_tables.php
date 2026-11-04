<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Index des trajets recherchés : un couple arrêt de départ → arrêt d'arrivée
        Schema::create('searched_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_stop_id')->constrained('stops')->cascadeOnDelete();
            $table->foreignId('to_stop_id')->constrained('stops')->cascadeOnDelete();
            $table->string('slug')->unique(); // depart--arrivee, pour la page /trajets/{slug}
            $table->unsignedInteger('searches_count')->default(0)->index();
            $table->string('outcome', 12)->nullable(); // direct, combination, walk, none
            $table->json('answer')->nullable(); // lignes à prendre, au dernier calcul
            $table->timestamp('last_searched_at')->nullable();
            $table->timestamps();

            $table->unique(['from_stop_id', 'to_stop_id']);
        });

        // Une ligne par recherche, sans donnée personnelle : ni IP, ni position exacte
        Schema::create('search_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('searched_route_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('from_stop_id')->nullable()->constrained('stops')->nullOnDelete();
            $table->foreignId('to_stop_id')->nullable()->constrained('stops')->nullOnDelete();
            $table->boolean('from_gps')->default(false);
            $table->string('outcome', 12)->index();
            $table->unsignedInteger('distance')->default(0); // vol d'oiseau, en mètres
            $table->unsignedSmallInteger('radius');
            $table->string('types', 60)->nullable(); // filtre de transport, ex. « sotra »
            $table->string('combination', 60)->nullable()->index(); // lignes de la 1re combinaison, ex. « 12-48 »
            // Zone d'environ 1 km (coordonnées arrondies) : situe les trajets sans réponse
            $table->string('from_area', 20);
            $table->string('to_area', 20);
            $table->timestamp('created_at')->index();
        });

        // Lignes proposées dans les résultats d'une recherche
        Schema::create('search_log_lines', function (Blueprint $table) {
            $table->foreignId('search_log_id')->constrained()->cascadeOnDelete();
            $table->foreignId('line_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 12); // direct, combination
            $table->unsignedTinyInteger('rank'); // 0 = proposée en premier

            $table->index('line_id');
        });

        // Consultations des fiches ligne, par jour
        Schema::create('line_views', function (Blueprint $table) {
            $table->date('date');
            $table->foreignId('line_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('views')->default(0);

            $table->primary(['date', 'line_id']);
            $table->index('line_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('line_views');
        Schema::dropIfExists('search_log_lines');
        Schema::dropIfExists('search_logs');
        Schema::dropIfExists('searched_routes');
    }
};
