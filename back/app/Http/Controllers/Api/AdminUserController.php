<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\AdminInvitation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Les comptes qui ont accès au tableau de bord. Tous les admins ont les mêmes droits.
 */
class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::orderBy('name')->get()->map(fn (User $user) => $this->present($user, $request->user()));

        return response()->json(['data' => $users]);
    }

    /** Crée le compte et envoie une invitation : le nouvel admin choisit son mot de passe. */
    public function store(Request $request): JsonResponse
    {
        $request->merge(['email' => mb_strtolower((string) $request->input('email'))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')],
        ], [
            'email.unique' => 'Cette adresse a déjà un accès.',
        ]);

        // Mot de passe aléatoire jamais communiqué : le compte reste fermé tant que l'invitation n'est pas acceptée
        $user = User::create([...$data, 'password' => Str::random(64)]);
        $sent = $this->invite($user, $request->user());

        return response()->json([
            'data' => $this->present($user, $request->user()),
            'message' => $sent
                ? "Invitation envoyée à {$user->email}."
                : 'Compte créé, mais l’email n’a pas pu partir. Réessayez avec « Renvoyer l’invitation ».',
        ], 201);
    }

    public function resend(Request $request, User $user): JsonResponse
    {
        if ($user->last_login_at) {
            throw ValidationException::withMessages(['user' => 'Ce compte est déjà actif.']);
        }

        return $this->invite($user, $request->user())
            ? response()->json(['message' => "Invitation renvoyée à {$user->email}."])
            : response()->json(['message' => 'L’email n’a pas pu partir. Réessayez plus tard.'], 502);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['user' => 'Vous ne pouvez pas retirer votre propre accès.']);
        }

        $user->tokens()->delete();
        Password::broker('users')->deleteToken($user);
        $user->delete();

        return response()->json(['message' => "Accès retiré à {$user->email}."]);
    }

    private function invite(User $user, User $by): bool
    {
        $token = Password::broker('invitations')->createToken($user);

        try {
            $user->notify(new AdminInvitation($token, $by->name));

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    /** @return array<string, mixed> */
    private function present(User $user, User $me): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'created_at' => $user->created_at?->toIso8601String(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'is_me' => $user->is($me),
        ];
    }
}
