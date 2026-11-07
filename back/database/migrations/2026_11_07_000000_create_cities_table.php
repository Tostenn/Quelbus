<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * QuelBus couvre d'autres villes qu'Abidjan : chaque ligne et chaque arrêt appartient à une ville.
 * Les sens de ligne ne viennent plus tous d'OpenStreetMap : `external_id` identifie la source
 * (« osm:10291017 », « sotra-pdf:301:aller »…).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cities', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            // Emprise de la ville, pour la reconnaître depuis une position et centrer la carte
            $table->decimal('min_lat', 9, 6);
            $table->decimal('min_lng', 9, 6);
            $table->decimal('max_lat', 9, 6);
            $table->decimal('max_lng', 9, 6);
            $table->unsignedSmallInteger('position')->default(0); // ordre d'affichage
            $table->timestamps();
        });

        $now = now();
        $abidjan = DB::table('cities')->insertGetId([
            'slug' => 'abidjan', 'name' => 'Abidjan',
            'min_lat' => 5.15, 'min_lng' => -4.3, 'max_lat' => 5.6, 'max_lng' => -3.7,
            'position' => 0, 'created_at' => $now, 'updated_at' => $now,
        ]);

        foreach (['lines', 'stops'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->foreignId('city_id')->nullable()->after('id')->constrained()->nullOnDelete();
            });
            DB::table($name)->update(['city_id' => $abidjan]);
        }

        Schema::table('line_directions', function (Blueprint $table) {
            $table->string('external_id')->nullable()->unique()->after('line_id');
            $table->unsignedBigInteger('osm_relation_id')->nullable()->change();
            // Seuls les terminus sont connus : arrêts intermédiaires et tracé restent à relever
            $table->boolean('is_partial')->default(false)->after('is_loop');
        });
        DB::table('line_directions')->update(['external_id' => DB::raw("'osm:' || osm_relation_id")]);
    }

    public function down(): void
    {
        DB::table('line_directions')->whereNull('osm_relation_id')->delete();
        Schema::table('line_directions', function (Blueprint $table) {
            $table->dropColumn(['external_id', 'is_partial']);
            $table->unsignedBigInteger('osm_relation_id')->nullable(false)->change();
        });
        foreach (['lines', 'stops'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropConstrainedForeignId('city_id'));
        }
        Schema::dropIfExists('cities');
    }
};
