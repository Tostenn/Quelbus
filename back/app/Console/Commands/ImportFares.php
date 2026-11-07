<?php

namespace App\Console\Commands;

use App\Services\Transit\FareImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('transit:fares
    {path=storage/app/transit/fares.json : Fichier JSON produit par scraper/fares.py}')]
#[Description('Importe les tarifs des lignes et les horaires (premier et dernier départ)')]
class ImportFares extends Command
{
    public function handle(FareImporter $importer): int
    {
        $path = $this->argument('path');
        $data = is_file($path) ? json_decode(file_get_contents($path), true) : null;
        if (! is_array($data)) {
            $this->error("Fichier introuvable ou JSON invalide : {$path}");

            return self::FAILURE;
        }

        $report = $importer->import($data);

        $this->table(['', 'Importés', 'Gardés (saisis dans le tableau de bord)'], [
            ['Tarifs', $report['fares'], $report['fares_kept']],
            ['Horaires', $report['schedules'], $report['schedules_kept']],
        ]);
        if ($report['anomalies']) {
            $this->warn(count($report['anomalies']).' anomalie(s) :');
            foreach ($report['anomalies'] as $anomaly) {
                $this->line("  - {$anomaly}");
            }
        }
        $this->info('Import terminé.');

        return self::SUCCESS;
    }
}
