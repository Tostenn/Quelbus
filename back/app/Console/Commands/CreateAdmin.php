<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('admin:create {email} {--name=Admin} {--password= : Sinon demandé de façon masquée}')]
#[Description('Crée ou met à jour un compte d’accès au tableau de bord')]
class CreateAdmin extends Command
{
    public function handle(): int
    {
        $email = mb_strtolower($this->argument('email'));
        $password = $this->option('password') ?: $this->secret('Mot de passe (12 caractères minimum)');

        if (! filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen((string) $password) < 12) {
            $this->error('Email invalide ou mot de passe trop court (12 caractères minimum).');

            return self::FAILURE;
        }

        $user = User::updateOrCreate(['email' => $email], ['name' => $this->option('name'), 'password' => $password]);
        $user->tokens()->delete();

        $this->info("Compte {$email} prêt.");

        return self::SUCCESS;
    }
}
