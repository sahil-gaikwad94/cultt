-- 020_seed.test.sql — the corpus is real, dimensioned, and rankable.
--
-- A seed that inserts rows with null vectors would look fine in a row count and
-- silently break the entire feed. These assertions check the properties the
-- Resonance Engine depends on, and prove cosine similarity in SQL agrees with
-- the TypeScript engine's premise: same-tag memes beat different-tag memes.

\set ON_ERROR_STOP on

do $$
declare
  memes_count int;
  tracks_count int;
  drops_count int;
  bad_dims int;
  same_tag float8;
  diff_tag float8;
  non_original int;
  empty_topic int;
begin
  select count(*) into memes_count from memes where status = 'live';
  if memes_count < 100 then
    raise exception 'seed FAIL: expected the 100+ meme corpus, found %', memes_count;
  end if;
  raise notice 'ok   seed: % live memes', memes_count;

  select count(*) into tracks_count from tracks;
  if tracks_count < 20 then
    raise exception 'seed FAIL: expected the track catalogue, found %', tracks_count;
  end if;
  raise notice 'ok   seed: % tracks', tracks_count;

  select count(*) into drops_count from daily_drops;
  if drops_count < 14 then
    raise exception 'seed FAIL: expected a fortnight of drops, found %', drops_count;
  end if;
  raise notice 'ok   seed: % daily drops scheduled', drops_count;

  -- A null or wrong-width vector is invisible in a row count and fatal to the
  -- engine. Check every row, not a sample.
  select count(*) into bad_dims from memes
   where style_vec is null or vector_dims(style_vec) <> 34;
  if bad_dims <> 0 then
    raise exception 'seed FAIL: % memes have a missing or wrong-width style_vec', bad_dims;
  end if;
  raise notice 'ok   seed: every meme has a real 34-d style vector';

  select count(*) into bad_dims from tracks
   where embedding is null or vector_dims(embedding) <> 48;
  if bad_dims <> 0 then
    raise exception 'seed FAIL: % tracks have a missing or wrong-width embedding', bad_dims;
  end if;
  raise notice 'ok   seed: every track has a real 48-d music embedding';

  -- Nothing in the corpus may be a real-world work: if a licensed or UGC row
  -- ever appears here the feed is shipping content without a clearance.
  select count(*) into non_original from memes
   where source <> 'pack'
      or (license_meta ->> 'origin') is distinct from 'cultured-original';
  if non_original <> 0 then
    raise exception 'seed FAIL: % memes are not marked as cultured originals', non_original;
  end if;
  raise notice 'ok   seed: every meme is a cultured original (no clearance risk)';

  -- Every meme has alt text, so the feed is usable with a screen reader.
  select count(*) into bad_dims from memes
   where coalesce(alt_text, '') = '' or coalesce(caption_text, '') = '';
  if bad_dims <> 0 then
    raise exception 'seed FAIL: % memes are missing caption or alt text', bad_dims;
  end if;
  raise notice 'ok   seed: every meme has caption and alt text';

  -- Every meme belongs to a feed tab other than the catch-all.
  select count(*) into empty_topic from memes where topic = 'all' or topic is null;
  if empty_topic > 0 then
    raise exception 'seed FAIL: % memes have no topic tab', empty_topic;
  end if;
  raise notice 'ok   seed: every meme is filed under a real feed tab';

  -- The engine's central premise, checked against the seeded vectors rather
  -- than against a fixture: two memes sharing a style tag must be closer than
  -- two memes whose tags do not overlap.
  select 1 - (a.style_vec <=> b.style_vec)
    into same_tag
    from memes a join memes b on b.slug = 'mk001'
   where a.slug = 'mk004';   -- mk001 and mk004 are both absurd + observational

  select 1 - (a.style_vec <=> b.style_vec)
    into diff_tag
    from memes a join memes b on b.slug = 'mk002'
   where a.slug = 'mk005';   -- deadpan/observational vs dark/work_horror

  if same_tag is null or diff_tag is null then
    raise exception 'seed FAIL: could not find the probe memes';
  end if;
  if same_tag <= diff_tag then
    raise exception 'seed FAIL: same-tag similarity (%) did not beat different-tag (%)',
      same_tag, diff_tag;
  end if;
  raise notice 'ok   seed: cosine separates same-tag (%) from different-tag (%)',
    round(same_tag::numeric, 3), round(diff_tag::numeric, 3);
end $$;

select 'ALL SEED TESTS PASSED' as result;
