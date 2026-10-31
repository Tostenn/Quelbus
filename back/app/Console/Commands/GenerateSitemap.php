<?php

namespace App\Console\Commands;

use App\Models\Line;
use App\Models\Stop;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sitemap:generate
    {path=../front/public/sitemap.xml : Fichier de sortie}
    {--url=https://quelbus.monradar.ci : Adresse du site}
    {--soutenir : Inclure la page /soutenir (une fois les dons activés)}')]
#[Description('Génère le sitemap du front : pages fixes, lignes et arrêts')]
class GenerateSitemap extends Command
{
    public function handle(): int
    {
        $base = rtrim($this->option('url'), '/');
        $paths = ['/', '/recherche', '/lignes', '/a-propos', '/contact'];
        if ($this->option('soutenir')) {
            $paths[] = '/soutenir';
        }

        Line::query()->orderBy('id')->each(function (Line $line) use (&$paths) {
            $paths[] = '/lignes/'.$line->slug;
        });
        Stop::query()->orderBy('id')->each(function (Stop $stop) use (&$paths) {
            $paths[] = '/arrets/'.$stop->slug;
        });

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach ($paths as $path) {
            $xml .= '  <url><loc>'.htmlspecialchars($base.$path, ENT_XML1).'</loc></url>'."\n";
        }
        $xml .= "</urlset>\n";

        $path = $this->argument('path');
        if (file_put_contents($path, $xml) === false) {
            $this->error("Impossible d'écrire dans {$path}.");

            return self::FAILURE;
        }

        $this->info(count($paths)." adresses écrites dans {$path}.");

        return self::SUCCESS;
    }
}
