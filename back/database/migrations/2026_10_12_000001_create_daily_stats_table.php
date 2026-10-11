<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_stats', function (Blueprint $table) {
            $table->date('date')->primary();
            $table->unsignedInteger('visits')->default(0);
            $table->unsignedInteger('searches')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_stats');
    }
};
