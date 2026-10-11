<?php

namespace App\Console\Commands;

use App\Models\Report;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('reports:export {path=storage/app/reports.csv : Fichier CSV de sortie}')]
#[Description('Exporte les signalements d’erreurs en CSV')]
class ExportReports extends Command
{
    public function handle(): int
    {
        $path = $this->argument('path');
        $file = fopen($path, 'w');

        if ($file === false) {
            $this->error("Impossible d'écrire dans {$path}.");

            return self::FAILURE;
        }

        fputcsv($file, ['date', 'type', 'message', 'page', 'email']);

        $count = 0;
        Report::orderByDesc('id')->each(function (Report $report) use ($file, &$count) {
            fputcsv($file, [
                $report->created_at?->toDateTimeString(),
                Report::KINDS[$report->kind] ?? $report->kind,
                $report->message,
                $report->page,
                $report->email,
            ]);
            $count++;
        });

        fclose($file);
        $this->info("{$count} signalement(s) exporté(s) dans {$path}.");

        return self::SUCCESS;
    }
}
