-- Factory (production) database seed 
-- this DB owns SORTING, WASHING, DRYING, FOLDING, and some DISPATCH events 

INSERT INTO lines (line_id, name, location) VALUES
  ('LINE-A', 'Linen Line A', 'Main Hall'),
  ('LINE-B', 'Linen Line B', 'Annex')
ON CONFLICT (line_id) DO NOTHING;

INSERT INTO machines (machine_id, line_id, station, model) VALUES
  ('SORT-A1', 'LINE-A', 'SORTING', 'SorterPro X'),
  ('WASH-A1', 'LINE-A', 'WASHING', 'AquaWash 3000'),
  ('DRY-A1',  'LINE-A', 'DRYING',  'ThermoDry 200'),
  ('FOLD-A1', 'LINE-A', 'FOLDING', 'FoldMaster 5'),
  ('SORT-B1', 'LINE-B', 'SORTING', 'SorterPro X'),
  ('WASH-B1', 'LINE-B', 'WASHING', 'AquaWash 3000'),
  ('DRY-B1',  'LINE-B', 'DRYING',  'ThermoDry 200'),
  ('FOLD-B1', 'LINE-B', 'FOLDING', 'FoldMaster 5')
ON CONFLICT (machine_id) DO NOTHING;

INSERT INTO production_events
  (batch_id, work_order_id, line_id, station, event_type, quantity, event_time, machine_id, operator, notes)
VALUES
  -- BATCH-0001 - COMPLETED (Line A). DISPATCH also exists in the App API (duplicate, agreeing qty 100)
  ('BATCH-0001', NULL, 'LINE-A', 'SORTING',  'SORTING_COMPLETED', 100, now() - interval '75 minutes', 'SORT-A1', 'anna',  NULL),
  ('BATCH-0001', NULL, 'LINE-A', 'WASHING',  'WASHING_COMPLETED', 100, now() - interval '55 minutes', 'WASH-A1', 'anna',  NULL),
  ('BATCH-0001', NULL, 'LINE-A', 'DRYING',   'DRYING_COMPLETED',  100, now() - interval '35 minutes', 'DRY-A1',  'ben',   NULL),
  ('BATCH-0001', NULL, 'LINE-A', 'FOLDING',  'FOLDING_COMPLETED', 100, now() - interval '18 minutes', 'FOLD-A1', 'ben',   NULL),
  ('BATCH-0001', NULL, 'LINE-A', 'DISPATCH', 'DISPATCH_ACCEPTED', 100, now() - interval '6 minutes',  NULL,      'clara', 'dispatched to Grand Hotel'),

  -- BATCH-0002 - IN_PROGRESS FOLDING (Line A). Duplicate + CONFLICT on SORTING (two rows, qty 60 vs 58)
  ('BATCH-0002', NULL, 'LINE-A', 'SORTING',  'SORTING_COMPLETED', 60,  now() - interval '65 minutes', 'SORT-A1', 'anna',  'first entry'),
  ('BATCH-0002', NULL, 'LINE-A', 'SORTING',  'SORTING_COMPLETED', 58,  now() - interval '64 minutes', 'SORT-A1', 'anna',  're-count (duplicate observation)'),
  ('BATCH-0002', NULL, 'LINE-A', 'WASHING',  'WASHING_COMPLETED', 60,  now() - interval '45 minutes', 'WASH-A1', 'anna',  NULL),
  ('BATCH-0002', NULL, 'LINE-A', 'DRYING',   'DRYING_COMPLETED',  60,  now() - interval '28 minutes', 'DRY-A1',  'ben',   NULL),
  ('BATCH-0002', NULL, 'LINE-A', 'FOLDING',  'FOLDING_COMPLETED', 59,  now() - interval '12 minutes', 'FOLD-A1', 'ben',   NULL),

  -- BATCH-0003 - IN_PROGRESS DRYING (Line A). LATE earlier-station event: SORTING event_time is after WASHING
  ('BATCH-0003', NULL, 'LINE-A', 'WASHING',  'WASHING_COMPLETED', 80,  now() - interval '40 minutes', 'WASH-A1', 'dan',   NULL),
  ('BATCH-0003', NULL, 'LINE-A', 'SORTING',  'SORTING_COMPLETED', 82,  now() - interval '30 minutes', 'SORT-A1', 'dan',   'late arrival — recorded after washing'),
  ('BATCH-0003', NULL, 'LINE-A', 'DRYING',   'DRYING_COMPLETED',  80,  now() - interval '10 minutes', 'DRY-A1',  'dan',   NULL),

  -- BATCH-0004 — IN_PROGRESS DRYING (Line A). MISSING DATA: no SORTING event
  ('BATCH-0004', NULL, 'LINE-A', 'WASHING',  'WASHING_COMPLETED', 70,  now() - interval '35 minutes', 'WASH-A1', 'dan',   NULL),
  ('BATCH-0004', NULL, 'LINE-A', 'DRYING',   'DRYING_COMPLETED',  70,  now() - interval '14 minutes', 'DRY-A1',  'dan',   NULL),

  -- BATCH-0005 — IN_PROGRESS WASHING (Line B). STALE: last event ~50 min ago (> 15 min threshold)
  ('BATCH-0005', NULL, 'LINE-B', 'SORTING',  'SORTING_COMPLETED', 50,  now() - interval '100 minutes', 'SORT-B1', 'eve',  NULL),
  ('BATCH-0005', NULL, 'LINE-B', 'WASHING',  'WASHING_COMPLETED', 50,  now() - interval '50 minutes',  'WASH-B1', 'eve',  NULL),

  -- BATCH-0006 — COMPLETED (Line B). DISPATCH present ONLY in the production DB 
  ('BATCH-0006', NULL, 'LINE-B', 'SORTING',  'SORTING_COMPLETED', 90,  now() - interval '80 minutes', 'SORT-B1', 'eve',   NULL),
  ('BATCH-0006', NULL, 'LINE-B', 'WASHING',  'WASHING_COMPLETED', 90,  now() - interval '60 minutes', 'WASH-B1', 'eve',   NULL),
  ('BATCH-0006', NULL, 'LINE-B', 'DRYING',   'DRYING_COMPLETED',  90,  now() - interval '40 minutes', 'DRY-B1',  'frank', NULL),
  ('BATCH-0006', NULL, 'LINE-B', 'FOLDING',  'FOLDING_COMPLETED', 88,  now() - interval '20 minutes', 'FOLD-B1', 'frank', NULL),
  ('BATCH-0006', NULL, 'LINE-B', 'DISPATCH', 'DISPATCH_ACCEPTED', 88,  now() - interval '4 minutes',  NULL,      'clara', 'dispatched to Seaside Resort'),

  -- BATCH-0007 — IN_PROGRESS SORTING (Line B). Candidate for a manager BLOCK
  ('BATCH-0007', NULL, 'LINE-B', 'SORTING',  'SORTING_COMPLETED', 40,  now() - interval '8 minutes',  'SORT-B1', 'eve',   NULL);

  -- BATCH-0008 — PLANNED: no production events (work order WO-1005 exists via the App API only)
