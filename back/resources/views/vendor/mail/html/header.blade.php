@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img src="{{ config('app.frontend_url') }}/email/quelbus-logo.png" class="logo" width="168" height="28" alt="{{ trim($slot) ?: 'QuelBus' }}">
</a>
</td>
</tr>
