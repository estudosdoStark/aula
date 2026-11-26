# Security Specification & Red Team Test Matrix — Conexão Lupion

## 1. Data Invariants
1. **Strict RBAC Separation**:
   - `aluno`: Read-only access to `posts`, `weeklyMenu`, `siteConfig`, and `posts/*/likes`. Cannot create, update, or delete any mural post, menu day, or urgent banner. Cannot self-promote to `docente` without valid institutional authorization (`facultyAccessCode` or bootstrapped verified admin).
   - `docente` (`facultyRole: 'professor'`): Can create, update, and delete **only** `posts` with `category == 'Aviso de Turma'` and `targetClass in ['6º Ano', '7º Ano', '8º Ano', '9º Ano', '1º Ano EM', '2º Ano EM', '3º Ano EM']`. Cannot modify general school posts (`Evento`, `Geral da Escola`, `Cardápio`), `weeklyMenu`, or `siteConfig`.
   - `docente` (`facultyRole: 'equipe_pedagogica'`): Full site editor — can create, update, and delete all `posts`, update `weeklyMenu`, and update `siteConfig`.
2. **PII Isolation**:
   - `/users/{userId}` stores `email`. `get` is restricted to `isOwner(userId)` or `isEquipePedagogica()`. `list` is restricted so non-admins can only query `resource.data.uid == request.auth.uid`.
3. **Immutability & Temporal Integrity**:
   - `uid` and `createdAt` on `/users/{userId}` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
   - `authorUid` and `createdAt` on `/posts/{postId}` are immutable after creation.
4. **Master Gate on Subcollections**:
   - `/posts/{postId}/likes/{userId}` requires `exists(/databases/$(database)/documents/posts/$(postId))` and `userId == request.auth.uid`.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Student Self-Promotion on Create**: Aluno creates `/users/{uid}` with `userType: 'docente'`, `facultyRole: 'equipe_pedagogica'`, and `facultyAccessCode: 'WRONG'`.
2. **Student Self-Promotion on Update**: Existing Aluno updates `/users/{uid}` changing `userType` from `'aluno'` to `'docente'` without valid authorization.
3. **Ghost Field Injection (Shadow Update)**: User sends `{ ..., isSuperAdmin: true }` to `/users/{uid}` or `/posts/{postId}`.
4. **Student Creates Class Post**: Aluno attempts `create` on `/posts/{postId}` with `category: 'Aviso de Turma'`.
5. **Student Updates Urgent Banner**: Aluno attempts `update` on `/siteConfig/urgentBanner`.
6. **Student Edits Menu**: Aluno attempts `update` on `/weeklyMenu/Segunda`.
7. **Professor Creates General Event**: Professor (`facultyRole: 'professor'`) attempts `create` on `/posts/{postId}` with `category: 'Evento'` and `targetClass: 'Geral'`.
8. **Professor Edits Weekly Menu**: Professor attempts `update` on `/weeklyMenu/Segunda`.
9. **Professor Edits Urgent Banner**: Professor attempts `update` on `/siteConfig/urgentBanner`.
10. **Identity Spoofing on Post**: Professor creates a post setting `authorUid` to another user's UID.
11. **Oversized String / Resource Poisoning**: Faculty submits a 2,000-character string in `title` (limit 160) or invalid `postId` with special characters (`bad/id/..`).
12. **PII Blanket Read**: Student attempts `get` on `/users/otherUserId` or `list` on `/users` without `uid` filter.
