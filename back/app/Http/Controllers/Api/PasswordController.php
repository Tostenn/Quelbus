<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class PasswordController extends Controller
{
    /**
     * Envoie un lien de réinitialisation. La réponse est la même que l'email existe ou non,
     * pour ne pas révéler qui a un compte.
     */
    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        Password::broker('users')->sendResetLink(['email' => mb_strtolower($data['email'])]);

        return response()->json([
            'message' => 'Si un compte existe pour cette adresse, un lien vient d’être envoyé. Pensez à regarder vos spams.',
        ]);
    }

    /**
     * Nouveau mot de passe, depuis un lien de réinitialisation ou une invitation.
     * Toutes les sessions ouvertes du compte sont fermées.
     */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:12', 'max:200', 'confirmed'],
            'invitation' => ['sometimes', 'boolean'],
        ], [
            'password.min' => 'Le mot de passe doit faire au moins 12 caractères.',
            'password.confirmed' => 'Les deux mots de passe ne correspondent pas.',
        ]);

        $broker = ($data['invitation'] ?? false) ? 'invitations' : 'users';
        $status = Password::broker($broker)->reset(
            [
                'email' => mb_strtolower($data['email']),
                'token' => $data['token'],
                'password' => $data['password'],
            ],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $user->tokens()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => 'Ce lien n’est plus valable. Demandez-en un nouveau.',
            ]);
        }

        return response()->json(['message' => 'Mot de passe enregistré.']);
    }
}
