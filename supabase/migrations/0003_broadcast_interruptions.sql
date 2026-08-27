-- Survive a dropped stream.
--
-- A broadcast that loses its encoder used to be marked 'ended', which is
-- terminal: FluxCast stopped polling LiveKit and never noticed the stream come
-- back. A dropped connection in the third quarter killed the broadcast for
-- good.
--
-- Losing the encoder is now an interruption, not an ending. The broadcast falls
-- back to 'ready' (the ingress is alive and waiting) and records when it
-- happened. Two things end a broadcast now: an admin says so, or the
-- interruption outlasts the grace period.
--
-- `started_at` stays set through an interruption. A 'ready' broadcast that has
-- a started_at is one that was live and dropped — that is how the UI tells
-- "hasn't begun yet" apart from "we lost the feed", without adding a status.

alter table public.broadcasts
  add column if not exists interrupted_at timestamptz;

comment on column public.broadcasts.interrupted_at is
  'When the encoder disconnected from a live broadcast. Null when healthy. '
  'A ready broadcast with started_at set and interrupted_at set is mid-dropout.';
