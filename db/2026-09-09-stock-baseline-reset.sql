-- ═══════════════════════════════════════════════════════════════════════
--  ตั้งต้นสต๊อกใหม่ (baseline reset)  —  2026-09-09
--
--  toun's stock ledger still carried the numbers used while building the
--  module: six materials that were never real, a receipt typed with the
--  delivery-note number "2", and an issue of 111 litres of primer that
--  never happened. Before the factory starts recording for real, all of
--  that has to go and the count has to start from what is actually on the
--  shelf today.
--
--  This is the one operation in the module that destroys history, so it is
--  fenced three ways:
--    • it is admin-only in the client, with no permission flag to hand out
--    • it refuses to run without the literal confirmation string
--    • the client downloads a full Excel backup of the ledger first
--
--  ⚠️ Per CLAUDE.md (BUG46): a DB function whose parameters change must be
--  DROPped and re-CREATEd, never CREATE OR REPLACE, and pg_proc must be
--  checked afterwards for exactly one row.
-- ═══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.reset_stock_baseline(jsonb, text, text);

CREATE FUNCTION public.reset_stock_baseline(
  p_rows       jsonb,   -- [{item_id, keep, qty, cost}, ...]
  p_created_by text,
  p_confirm    text     -- must be exactly 'RESET-STOCK'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     jsonb;
  v_item    uuid;
  v_qty     numeric;
  v_cost    numeric;
  v_wiped   int;
  v_kept    int := 0;
  v_removed int := 0;
  v_healed  int := 0;
  v_value   numeric := 0;
BEGIN
  -- A stray or mistyped RPC call must never be able to empty the ledger.
  IF p_confirm IS DISTINCT FROM 'RESET-STOCK' THEN
    RAISE EXCEPTION 'CONFIRM_REQUIRED';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'NO_ROWS';
  END IF;

  -- Hold every material for the whole rewrite, so nobody's receipt can land
  -- between the wipe and the new opening balance and be silently erased.
  PERFORM 1 FROM stock_items ORDER BY id FOR UPDATE;

  DELETE FROM stock_movements;
  GET DIAGNOSTICS v_wiped = ROW_COUNT;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_item := (v_row->>'item_id')::uuid;

    IF COALESCE((v_row->>'keep')::boolean, true) THEN
      v_qty  := COALESCE((v_row->>'qty')::numeric, 0);
      v_cost := COALESCE((v_row->>'cost')::numeric, 0);
      IF v_qty < 0 OR v_cost < 0 THEN
        RAISE EXCEPTION 'NEGATIVE_VALUE';
      END IF;

      UPDATE stock_items
         SET qty_current   = v_qty,
             cost_per_unit = v_cost,
             updated_at    = now()
       WHERE id = v_item;

      INSERT INTO stock_movements
        (item_id, movement_type, qty, balance_after, unit_cost, ref_type, note, created_by)
      VALUES
        (v_item, 'initial', v_qty, v_qty, v_cost, 'initial',
         'ยอดตั้งต้น — ตั้งต้นระบบใหม่', p_created_by);

      v_kept  := v_kept + 1;
      v_value := v_value + v_qty * v_cost;
    ELSE
      -- stock_movements.item_id cascades, so the row's history goes with it.
      DELETE FROM stock_items WHERE id = v_item;
      v_removed := v_removed + 1;
    END IF;
  END LOOP;

  -- Anything the client did not send — a material added by somebody else
  -- while this screen was open — still has to end up with an opening
  -- balance, or it would sit there with a quantity and no ledger behind it.
  -- (Five materials were already in exactly that state before this ran.)
  INSERT INTO stock_movements
    (item_id, movement_type, qty, balance_after, unit_cost, ref_type, note, created_by)
  SELECT i.id, 'initial', i.qty_current, i.qty_current, COALESCE(i.cost_per_unit, 0), 'initial',
         'ยอดตั้งต้น — ตั้งต้นระบบใหม่ (ไม่ได้อยู่ในรายการที่ส่งมา)', p_created_by
    FROM stock_items i
   WHERE NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.item_id = i.id);
  GET DIAGNOSTICS v_healed = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_movements', v_wiped,
    'kept_items',        v_kept,
    'removed_items',     v_removed,
    'healed_items',      v_healed,
    'total_value',       v_value
  );
END;
$$;

-- Verification that BUG46 made mandatory — must return exactly one row:
--   select oid::regprocedure from pg_proc where proname = 'reset_stock_baseline';
