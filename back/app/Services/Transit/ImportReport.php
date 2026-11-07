<?php

namespace App\Services\Transit;

class ImportReport
{
    public int $linesCreated = 0;

    public int $linesDeleted = 0;

    public int $directionsCreated = 0;

    public int $directionsUpdated = 0;

    public int $directionsDeleted = 0;

    /** Sens modifiés dans le tableau de bord, laissés tels quels */
    public int $directionsKept = 0;

    public int $stopsCreated = 0;

    public int $stopsDeleted = 0;

    /** @var list<string> */
    public array $anomalies = [];

    public function anomaly(string $message): void
    {
        $this->anomalies[] = $message;
    }
}
