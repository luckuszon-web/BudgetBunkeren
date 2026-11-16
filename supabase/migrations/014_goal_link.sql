-- Opsparingsmål, der fylder sig selv: kobl et mål til en kategori (fx "Opsparing & investering"),
-- så tæller pengene, du flytter dertil, som indbetalinger fra en bestemt dato. Kan køres flere gange.
alter table public.goals add column if not exists linked_category_id bigint references public.categories on delete set null;
alter table public.goals add column if not exists linked_since date;
