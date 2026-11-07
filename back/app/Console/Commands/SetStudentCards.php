<?php

namespace App\Console\Commands;

use App\Models\Line;
use App\Models\TransitChange;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Règle générale de la SOTRA : les lignes à 2 chiffres acceptent la carte étudiant, celles à 3 chiffres non.
 * Les exceptions se passent en options, par numéro de ligne.
 *
 *   php artisan transit:student-cards --dry-run
 *   php artisan transit:student-cards --refuse=19 --refuse=82 --accept=205
 */
#[Signature('transit:student-cards
    {--refuse=* : Ligne à 2 chiffres qui n\'accepte PAS la carte (répétable)}
    {--accept=* : Ligne à 3 chiffres qui accepte la carte (répétable)}
    {--city= : Limiter à une ville (slug : abidjan, bouake…)}
    {--force : Écraser aussi les lignes modifiées dans le tableau de bord}
    {--dry-run : Afficher ce qui changerait sans rien enregistrer}')]
#[Description('Renseigne la carte étudiant des lignes SOTRA : 2 chiffres oui, 3 chiffres non, sauf exceptions')]
class SetStudentCards extends Command
{
    public function handle(): int
    {
        $refuse = $this->refs('refuse');
        $accept = $this->refs('accept');

        $lines = Line::query()
            ->where('type', 'sotra')
            ->whereNotNull('ref')
            ->when($this->option('city'), fn ($q, $city) => $q->whereHas('city', fn ($c) => $c->where('slug', $city)))
            ->get();

        $changes = [];
        $kept = 0;
        $skipped = [];
        foreach ($lines as $line) {
            $ref = ltrim((string) $line->ref, '0') ?: '0';
            if (! ctype_digit($ref)) {
                $skipped[] = $line->ref;

                continue;
            }
            $accepts = match (true) {
                in_array($ref, $refuse, true) => false,
                in_array($ref, $accept, true) => true,
                default => (int) $ref < 100,
            };
            if ($line->accepts_student_card === $accepts) {
                continue;
            }
            if ($line->fare_edited_at && ! $this->option('force')) {
                $kept++;

                continue;
            }
            $changes[] = [$line, $accepts];
        }

        $this->table(['Ligne', 'Avant', 'Après'], array_map(fn ($c) => [
            $c[0]->ref.' · '.$c[0]->name,
            $this->label($c[0]->accepts_student_card),
            $this->label($c[1]),
        ], $changes));

        $unknown = array_diff([...$refuse, ...$accept], $lines->map(fn ($l) => ltrim((string) $l->ref, '0'))->all());
        if ($unknown) {
            $this->warn('Numéros inconnus (ignorés) : '.implode(', ', $unknown));
        }
        if ($skipped) {
            $this->warn('Numéros non numériques (ignorés) : '.implode(', ', $skipped));
        }
        if ($kept) {
            $this->line("{$kept} ligne(s) modifiée(s) dans le tableau de bord, laissée(s) telle(s) quelle(s) (--force pour les écraser).");
        }

        if ($this->option('dry-run')) {
            $this->info(count($changes).' ligne(s) changeraient. Rien n\'a été enregistré (--dry-run).');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($changes) {
            foreach ($changes as [$line, $accepts]) {
                $before = $line->fareSummary();
                $line->update(['accepts_student_card' => $accepts]);
                TransitChange::record(null, $line, 'fare', $before, $line->fareSummary());
            }
        });
        $this->info(count($changes).' ligne(s) mise(s) à jour.');

        return self::SUCCESS;
    }

    /**
     * @return list<string> numéros sans zéro de tête (« 02 » -> « 2 »), séparés par des virgules ou répétés
     */
    private function refs(string $option): array
    {
        $refs = [];
        foreach ((array) $this->option($option) as $value) {
            foreach (explode(',', (string) $value) as $ref) {
                $ref = ltrim(trim($ref), '0');
                if ($ref !== '') {
                    $refs[] = $ref;
                }
            }
        }

        return array_values(array_unique($refs));
    }

    private function label(?bool $accepts): string
    {
        return $accepts === null ? 'on ne sait pas' : ($accepts ? 'acceptée' : 'non acceptée');
    }
}
