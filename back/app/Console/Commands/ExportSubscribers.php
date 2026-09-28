<?php

namespace App\Console\Commands;

use App\Models\Subscriber;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('subscribers:export {path=storage/app/subscribers.csv : Fichier CSV de sortie}')]
#[Description('Exporte les inscriptions (prénom, nom, email, profil) en CSV')]
class ExportSubscribers extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $path = $this->argument('path');
        $file = fopen($path, 'w');

        if ($file === false) {
            $this->error("Impossible d'écrire dans {$path}.");

            return self::FAILURE;
        }

        fputcsv($file, ['prenom', 'nom', 'email', 'profil', 'message', 'inscrit_le']);

        $count = 0;
        Subscriber::orderBy('id')->each(function (Subscriber $subscriber) use ($file, &$count) {
            fputcsv($file, [
                $subscriber->first_name,
                $subscriber->last_name,
                $subscriber->email,
                $subscriber->profile,
                $subscriber->message,
                $subscriber->created_at?->toDateTimeString(),
            ]);
            $count++;
        });

        fclose($file);
        $this->info("{$count} inscription(s) exportée(s) dans {$path}.");

        return self::SUCCESS;
    }
}
