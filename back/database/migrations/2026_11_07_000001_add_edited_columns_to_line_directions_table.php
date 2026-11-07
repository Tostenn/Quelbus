<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un sens dont les arrêts ont été saisis dans le tableau de bord : l'import ne doit plus l'écraser.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('line_directions', function (Blueprint $table) {
            $table->timestamp('edited_at')->nullable()->after('geometry');
            $table->foreignId('edited_by')->nullable()->after('edited_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('line_directions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('edited_by');
            $table->dropColumn('edited_at');
        });
    }
};
