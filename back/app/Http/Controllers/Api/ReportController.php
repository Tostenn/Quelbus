<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReportRequest;
use App\Models\Report;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function store(StoreReportRequest $request): JsonResponse
    {
        $message = 'Merci ! On vérifie et on corrige au plus vite.';

        // Champ piège rempli : robot, on ne garde rien.
        if (filled($request->input('website'))) {
            return response()->json(['message' => $message], 201);
        }

        Report::create($request->safe()->except('website'));

        return response()->json(['message' => $message], 201);
    }
}
