<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Waitlist gating: `public.is_approved()` backs RESTRICTIVE RLS on user tables plus `assertApproved` in API auth; why: one source of truth that blocks both app and API.
- Public waitlist sign-ups go through an unauthenticated server fn that validates input and inserts with the admin client; table is admin-read-only. Why: no anon table access needed.
