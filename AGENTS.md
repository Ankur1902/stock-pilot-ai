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

- Inventory data is read/written from the browser Supabase client via react-query hooks in src/lib/inventory.ts; stock changes go only through the `record_stock_movement` RPC so stock updates stay atomic and never go negative.
- AI calls run server-side only: streaming chat via the `/api/chat` server route, one-shot features via `src/lib/ai.functions.ts`; both build an RLS-scoped inventory snapshot (`src/lib/ai/inventory-context.server.ts`) so the model only sees the signed-in user's data.
- Chat history is threaded and stored per user in `chat_threads`/`chat_messages` (AI SDK UIMessage JSON keyed by message id) so it syncs across devices.
- Receiving a purchase order goes through the `receive_purchase_order` RPC, which reuses `record_stock_movement` so stock changes stay atomic.
- Low-stock alerts are created by a database trigger on `products` so every stock path (manual, movement, PO, import) triggers them.
