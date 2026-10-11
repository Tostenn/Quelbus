<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('donations', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->unsignedInteger('amount'); // en francs CFA
            $table->string('currency', 3)->default('XOF');
            $table->string('status', 20)->default('pending')->index(); // pending, success, failed, abandoned
            $table->string('name', 80)->nullable();
            $table->string('email')->nullable();
            $table->text('message')->nullable();
            $table->string('channel', 40)->nullable(); // mobile_money, card…
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('donations');
    }
};
