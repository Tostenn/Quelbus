<?php

namespace App\Http\Requests;

use App\Models\Line;
use App\Services\Transit\RouteSearchService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'from_lat' => ['required', 'numeric', 'between:-90,90'],
            'from_lng' => ['required', 'numeric', 'between:-180,180'],
            'to_lat' => ['required', 'numeric', 'between:-90,90'],
            'to_lng' => ['required', 'numeric', 'between:-180,180'],
            'radius' => ['nullable', 'integer', Rule::in(RouteSearchService::RADII)],
            'types' => ['nullable', 'array'],
            'types.*' => [Rule::in(Line::TYPES)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'from_lat.required' => 'Indiquez votre point de départ.',
            'from_lng.required' => 'Indiquez votre point de départ.',
            'to_lat.required' => 'Indiquez votre destination.',
            'to_lng.required' => 'Indiquez votre destination.',
            'radius.in' => 'Le rayon doit être de 300, 500 ou 800 m.',
        ];
    }
}
