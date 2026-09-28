<?php

namespace App\Http\Requests;

use App\Models\Subscriber;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSubscriberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'first_name' => trim((string) $this->input('first_name')),
            'last_name' => trim((string) $this->input('last_name')),
            'email' => mb_strtolower(trim((string) $this->input('email'))),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'profile' => ['required', Rule::in(Subscriber::PROFILES)],
            'message' => ['nullable', 'string', 'max:2000'],
            // Champ piège invisible pour les robots : laissé vide par les humains.
            'website' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'first_name.required' => 'Indiquez votre prénom.',
            'first_name.max' => 'Le prénom est trop long.',
            'last_name.required' => 'Indiquez votre nom.',
            'last_name.max' => 'Le nom est trop long.',
            'email.required' => 'Indiquez votre adresse email.',
            'email.email' => 'Cette adresse email ne semble pas valide.',
            'email.max' => "L'adresse email est trop longue.",
            'profile.required' => 'Dites-nous comment vous souhaitez participer.',
            'profile.in' => 'Choisissez une des options proposées.',
            'message.max' => 'Le message ne doit pas dépasser 2000 caractères.',
        ];
    }
}
