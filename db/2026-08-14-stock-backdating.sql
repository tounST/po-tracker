-- Applied to Supabase rkdxbxtakvisroxelrvq on 2026-08-14
-- migration name: stock_movement_backdating
--
-- WHY
-- toun asked for an Excel round-trip so stock staff who cannot use the app can
-- type a batch into a spreadsheet and upload it, then print the result as a
-- paper report of what came in and went out, and when.
--
-- That only works if an imported row can carry the day the material actually
-- moved. Until now every movement was stamped now(), so a week typed in on
-- Friday would report every receipt as arriving on Friday — which makes the
-- report worthless and would push a late entry into the wrong month.
--
-- THE HARD PART
-- balance_after is a running balance, and both the daily and the monthly
-- figures are derived by diffing consecutive balance_after values. Appending is
-- easy: take the item's current quantity and add to it. Inserting into the
-- middle is not — every later row of that material becomes stale by the same
-- delta, and a broken chain corrupts every report silently.
--
-- So a retroactive insert takes its balance from the row that precedes it in
-- time, then shifts every later row of that material by its delta. Verified
-- against this database on a throwaway material: entering 1 Aug, then 10 Aug,
-- then 12 Aug, and finally backdating 5 Aug produced 100 → 70 → 120 → 100,
-- exactly the chain you get entering them in order. A backdated stocktake on
-- 7 Aug then gave 100 → 70 → 60 → 110 → 90. The material was deleted after.
--
-- GUARDS
--   FUTURE_DATE               — nothing may be dated more than a day ahead
--   INSUFFICIENT_STOCK        — the row itself may not go below zero
--   RETRO_WOULD_GO_NEGATIVE   — nor may any later row once it has been shifted
--                               (tested: issuing 90 on 2 Aug is refused because
--                                it would take 5 Aug negative, even though
--                                100 was on hand on 2 Aug)
--
-- ACCEPTED APPROXIMATION
-- The moving average is still blended against the balance on hand now, not
-- replayed from the insertion point. An average cannot be un-blended from a
-- single historical row, and reverse_stock_movement already makes the same
-- trade. Quantities and the per-row stamped unit_cost — which is what every
-- report actually reads — stay exact.
--
-- Backwards compatible: p_created_at defaults to NULL, so every existing caller
-- keeps stamping now() and appending exactly as before.

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_item_id uuid, p_type text, p_qty numeric, p_unit_cost numeric,
  p_po_number text, p_note text, p_created_by text,
  p_doc_no text DEFAULT NULL::text, p_supplier text DEFAULT NULL::text,
  p_photo_url text DEFAULT NULL::text, p_created_at timestamptz DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qty_now   numeric;
  v_avg       numeric;
  v_at        timestamptz;
  v_last_at   timestamptz;
  v_retro     boolean;
  v_prev_bal  numeric;
  v_delta     numeric;
  v_row_bal   numeric;
  v_unit      numeric;
  v_new_avg   numeric;
  v_base      numeric;
  v_min_bal   numeric;
  v_mv_id     uuid;
BEGIN
  IF p_qty IS NULL OR p_qty < 0 THEN
    RAISE EXCEPTION 'BAD_QTY';
  END IF;
  IF p_type NOT IN ('in', 'out', 'adjust') THEN
    RAISE EXCEPTION 'BAD_TYPE';
  END IF;

  -- FOR UPDATE is the whole point: it serialises movements per material (BUG32).
  SELECT qty_current, cost_per_unit INTO v_qty_now, v_avg
  FROM stock_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  v_at := COALESCE(p_created_at, now());
  IF v_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'FUTURE_DATE';
  END IF;

  SELECT max(created_at) INTO v_last_at FROM stock_movements WHERE item_id = p_item_id;
  v_retro := v_last_at IS NOT NULL AND v_at < v_last_at;

  IF v_retro THEN
    SELECT balance_after INTO v_prev_bal
    FROM stock_movements
    WHERE item_id = p_item_id AND created_at <= v_at
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    v_prev_bal := COALESCE(v_prev_bal, 0);
  ELSE
    v_prev_bal := COALESCE(v_qty_now, 0);
  END IF;

  IF p_type = 'in' THEN
    v_delta := p_qty;
    v_unit  := COALESCE(p_unit_cost, v_avg);
    v_base  := GREATEST(COALESCE(v_qty_now, 0), 0);
    IF (v_base + p_qty) > 0 THEN
      v_new_avg := ROUND((v_base * COALESCE(v_avg, 0) + p_qty * v_unit) / (v_base + p_qty), 4);
    ELSE
      v_new_avg := v_unit;
    END IF;
  ELSIF p_type = 'out' THEN
    v_delta   := -p_qty;
    v_unit    := v_avg;
    v_new_avg := v_avg;
  ELSE  -- adjust: p_qty is the new absolute balance at that point in time
    v_delta   := p_qty - v_prev_bal;
    v_unit    := v_avg;
    v_new_avg := v_avg;
  END IF;

  v_row_bal := v_prev_bal + v_delta;

  IF v_row_bal < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_prev_bal;
  END IF;
  IF v_retro AND v_delta < 0 THEN
    SELECT min(balance_after + v_delta) INTO v_min_bal
    FROM stock_movements WHERE item_id = p_item_id AND created_at > v_at;
    IF COALESCE(v_min_bal, 0) < 0 THEN
      RAISE EXCEPTION 'RETRO_WOULD_GO_NEGATIVE:%', v_prev_bal;
    END IF;
  END IF;

  INSERT INTO stock_movements
    (item_id, movement_type, qty, balance_after, unit_cost,
     ref_type, ref_id, note, created_by, doc_no, supplier, photo_url, created_at)
  VALUES
    (p_item_id, p_type, p_qty, v_row_bal, v_unit,
     CASE WHEN COALESCE(p_po_number,'') <> '' THEN 'po' ELSE 'manual' END,
     NULLIF(p_po_number,''), p_note, p_created_by,
     NULLIF(p_doc_no,''), NULLIF(p_supplier,''), NULLIF(p_photo_url,''), v_at)
  RETURNING id INTO v_mv_id;

  IF v_retro THEN
    UPDATE stock_movements
       SET balance_after = balance_after + v_delta
     WHERE item_id = p_item_id
       AND id <> v_mv_id
       AND (created_at > v_at OR (created_at = v_at AND id > v_mv_id));
  END IF;

  UPDATE stock_items
     SET qty_current   = COALESCE(v_qty_now, 0) + v_delta,
         cost_per_unit = v_new_avg,
         updated_at    = now()
   WHERE id = p_item_id;

  RETURN json_build_object(
    'movement_id',   v_mv_id,
    'balance_after', v_row_bal,
    'unit_cost',     v_unit,
    'avg_cost',      v_new_avg,
    'backdated',     v_retro
  );
END;
$function$;
