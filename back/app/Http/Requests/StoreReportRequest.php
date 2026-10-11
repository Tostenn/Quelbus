<?php

namespace App\Http\Requests;

use App\Models\Report;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'message' => trim((string) $this->input('message')),
            'email' => mb_strtolower(trim((string) $this->input('email'))) ?: null,
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'page' => ['required', 'string', 'max:500'],
            'line_id' => ['nullable', 'integer', 'exists:lines,id'],
            'stop_id' => ['nullable', 'integer', 'exists:stops,id'],
            'kind' => ['required', Rule::in(array_keys(Report::KINDS))],
            'message' => ['required', 'string', 'min:5', 'max:2000'],
            'email' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kind.required' => 'Choisissez le type d’erreur.',
            'message.required' => 'Décrivez ce qui ne va pas.',
            'message.min' => 'Un peu plus de détails, s’il vous plaît.',
            'email.email' => 'Cette adresse email n’est pas valide.',
        ];
    }
}
