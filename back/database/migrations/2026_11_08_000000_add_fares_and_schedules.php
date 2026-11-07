<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tarifs (par ligne), carte étudiant, et plage de service (premier et dernier départ, par sens).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lines', function (Blueprint $table) {
            $table->unsignedSmallInteger('fare')->nullable()->after('operator'); // FCFA, trajet simple
            $table->string('fare_type', 20)->nullable()->after('fare'); // MONBUS, WIBUS, EXPRESS…
            $table->boolean('accepts_student_card')->nullable()->after('fare_type'); // null : on ne sait pas
            // Tarif saisi dans le tableau de bord : l'import ne l'écrase plus
            $table->timestamp('fare_edited_at')->nullable()->after('accepts_student_card');
        });

        Schema::create('line_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('line_direction_id')->constrained()->cascadeOnDelete();
            $table->string('day_type', 10); // tous, semaine, samedi, dimanche (et jours fériés)
            $table->time('first_departure');
            $table->time('last_departure');
            $table->string('source')->nullable(); // « affiche du terminus », « Linfodrome, 20 mai 2026 »…
            $table->string('source_url', 500)->nullable();
            $table->date('observed_on')->nullable();
            // null : importé ; sinon saisi par cet admin (l'import n'y touche pas)
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['line_direction_id', 'day_type']);
        });

        // Qui a changé quoi dans le réseau, depuis le tableau de bord
        Schema::create('transit_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('subject_type', 30); // line, direction
            $table->unsignedBigInteger('subject_id');
            $table->string('field', 30); // fare, schedules, stops
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transit_changes');
        Schema::dropIfExists('line_schedules');
        Schema::table('lines', function (Blueprint $table) {
            $table->dropColumn(['fare', 'fare_type', 'accepts_student_card', 'fare_edited_at']);
        });
    }
};
