# SalesPulse v1.1 — Advanced Build Plan

Everything you asked for is in scope, but it splits into things I can build directly and things that need credentials/decisions from you. I'll ship in phases so each one is usable on its own.

---

## Phase 1 — Coordination & CRUD polish (no new dependencies)

Build immediately, no input needed from you.

**Cross-page coordination**
- Clickable rows in every list (contacts, companies, deals, tasks) jump to detail.
- Contact detail → list their deals, tasks, activities, parent company.
- Company detail → list contacts, deals, recent activity.
- Deal detail → contact, company, tasks, full activity timeline, stage history.
- Breadcrumbs in header that reflect the current entity.
- Dashboard "Recent items" + "My open tasks" link straight through.

**Missing CRUD + UX**
- Edit + delete with confirm dialog on contacts, companies, deals, tasks, templates.
- Friendly empty states (illustration + CTA) on every list and detail tab.
- Loading skeletons instead of blank flicker.
- Toast on every success/error path.

**Search, filters, bulk**
- Global ⌘K command palette: jump to contact/company/deal by name.
- Per-table filters: owner, stage, status, date range, tag.
- Sortable column headers.
- Multi-select with bulk delete + bulk reassign owner.

**Reports depth**
- Win rate, average sales cycle, leaderboard by owner.
- Weighted pipeline forecast (value × stage probability).
- Activity heatmap (per user / per week).
- CSV export on every report.

## Phase 2 — Re-introduce auth + role-based access control

You earlier said "remove authentication"; access control requires it back. I'll:
- Re-enable email/password + Microsoft sign-in.
- Restore RLS, but keep policies clean (admin / manager / rep / read-only via the existing `app_role` enum).
- Add an Admin → Users page: invite by email, change role, deactivate.
- UI gates: managers see all data, reps see own + team, read-only hides edit buttons.
- Audit log table for sensitive changes.

I need one decision from you before starting Phase 2:
- **Sign-up policy**: open self-serve sign-up, or admin-invite only?

## Phase 3 — External integrations (need credentials)

These can't be built blindly — each needs an OAuth app or API key:

| Integration | What's needed from you |
|---|---|
| **Outlook / Microsoft 365 email send + sync** | Azure AD app registration (client ID + secret, Mail.Send + Mail.Read scopes). Per-user OAuth consent. |
| **Google Calendar two-way sync** | Either personal Google OAuth (per-user, you create OAuth credentials in Google Cloud Console), or service-account if it's a single shared calendar. |
| **Teams notifications** | Already wired via incoming webhook URL in Settings → Integrations. For Teams *bot* (send DMs, post as the app), needs Azure AD app + bot framework setup. |
| **Transactional emails** (e.g. "task assigned to you") | Use Lovable's built-in email infra — I'll set up the sender domain when we get there. |

For each integration I'll come back with a short setup checklist; nothing here will be guessed.

---

## Execution order

1. Phase 1 lands first (this turn and the next 1–2 turns).
2. You answer the sign-up policy question; I do Phase 2.
3. We pick which Phase 3 integration matters most and tackle them one at a time, starting with whichever you use today.

## Technical notes

- All Phase 1 work is pure frontend + existing tables. No schema changes except adding an `audit_log` table in Phase 2 and an `oauth_tokens` table in Phase 3.
- Command palette will use the existing `cmdk` package (already installed via shadcn).
- CSV export will be client-side (no new dep) using a small helper.
- Bulk operations will go through TanStack server functions so RLS still applies after Phase 2.
- I'll keep design language consistent: dark navy sidebar, white surfaces, subtle borders.

---

**Approve this plan and I'll start with Phase 1 immediately.** If you want a different ordering (e.g. do auth + roles first because you're onboarding users tomorrow), say so and I'll re-sequence.