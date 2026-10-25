<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', mb_strtolower($credentials['email']))->first();
        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Email ou mot de passe incorrect.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'token' => $user->createToken('admin', ['*'], now()->addDays(30))->plainTextToken,
            'user' => $user->only(['name', 'email']),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->only(['id', 'name', 'email'])]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnecté.']);
    }
}
