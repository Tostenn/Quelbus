<?php

namespace App\Http\Requests;

use App\Models\Donation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreDonationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')) ?: null,
            'email' => mb_strtolower(trim((string) $this->input('email'))) ?: null,
            'message' => trim((string) $this->input('message')) ?: null,
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:'.Donation::MIN_AMOUNT, 'max:'.Donation::MAX_AMOUNT],
            'name' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255'],
            'message' => ['nullable', 'string', 'max:500'],
            'website' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amount.required' => 'Choisissez un montant.',
            'amount.integer' => 'Le montant doit être un nombre entier de francs.',
            'amount.min' => 'Le don minimum est de '.Donation::MIN_AMOUNT.' F.',
            'amount.max' => 'Le don maximum en ligne est de 1 000 000 F.',
            'email.email' => 'Cette adresse email n’est pas valide.',
        ];
    }
}
