<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Historique des newsletters envoyées depuis le tableau de bord.
        Schema::create('newsletters', function (Blueprint $table) {
            $table->id();
            $table->string('subject', 150);
            $table->text('body');
            $table->string('audience', 20);
            $table->unsignedInteger('recipients');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('newsletters');
    }
};
