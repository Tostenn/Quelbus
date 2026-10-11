<?php

namespace App\Console\Commands;

use App\Services\Transit\TransitImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

#[Signature('transit:import
    {path=storage/app/transit/abidjan_bus.json : Fichier JSON produit par scraper/scrape.py}
    {--prune : Supprimer les sens, lignes et arrêts absents du fichier}')]
#[Description('Importe les lignes, sens et arrêts de bus depuis le JSON du scraper')]
class ImportTransit extends Command
{
    public function handle(TransitImporter $importer): int
    {
        $path = $this->argument('path');

        if (! is_file($path)) {
            $this->error("Fichier introuvable : {$path}");

            return self::FAILURE;
        }

        $data = json_decode(file_get_contents($path), true);
        if (! is_array($data)) {
            $this->error("JSON invalide : {$path}");

            return self::FAILURE;
        }

        if (($data['counts']['missing'] ?? 0) > 0) {
            $this->warn("Le fichier est incomplet : {$data['counts']['missing']} ligne(s) n'ont pas été scrapées.");
            if ($this->option('prune')) {
                $this->error('--prune refusé sur un fichier incomplet (cela supprimerait des lignes encore valides).');

                return self::FAILURE;
            }
        }

        try {
            $report = $importer->import($data, $this->option('prune'));
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->table(['', 'Créés', 'Mis à jour', 'Supprimés'], [
            ['Lignes', $report->linesCreated, '-', $report->linesDeleted],
            ['Sens', $report->directionsCreated, $report->directionsUpdated, $report->directionsDeleted],
            ['Arrêts', $report->stopsCreated, '-', $report->stopsDeleted],
        ]);

        if ($report->anomalies) {
            $this->warn(count($report->anomalies).' anomalie(s) :');
            foreach ($report->anomalies as $anomaly) {
                $this->line("  - {$anomaly}");
            }
        }

        $this->info('Import terminé.');

        return self::SUCCESS;
    }
}
