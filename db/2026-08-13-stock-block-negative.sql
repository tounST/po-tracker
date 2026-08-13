-- Applied to Supabase rkdxbxtakvisroxelrvq on 2026-08-13
-- migration name: block_negative_stock_balance
--
-- WHY
-- A full-loop test of the stock module (real RPC calls against this database,
-- on a throwaway material that was deleted afterwards) showed that an issue
-- larger than the balance on hand was accepted silently: 140 sheets on hand,
-- issue 9,999, balance −9,859. Two things follow from that and neither is
-- recoverable by looking at the screen:
--
--   1. Inventory value goes negative (−9,859 × 10 = −98,590 บาท).
--   2. Receiving into a negative balance destroys the moving average. The
--      function blends against GREATEST(qty_current, 0), so with a balance of
--      −300 at 62.50 a receipt of 100 @ 40 sets the average to 40 flat — the
--      real cost of everything bought before is simply gone.
--   3. The ministry iSingleForm report prints a negative closing balance,
--      which cannot be filed.
--
-- A negative balance is always a bookkeeping error, never a physical fact.
-- Both honest remedies — record the receipt that was missed, or correct the
-- count with ปรับยอด — are one tap away in the UI, so refusing here pushes the
-- ledger toward the truth instead of away from it. The quantity actually on
-- hand travels inside the error message so the client can name it even when
-- the screen is stale because someone else issued first.
--
-- Safe to apply: at the time of writing the ledger holds only the 15 opening
-- balances, so no existing workflow depends on the permissive behaviour.

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_item_id uuid, p_type text, p_qty numeric, p_unit_cost numeric,
  p_po_number text, p_note text, p_created_by text,
  p_doc_no text DEFAULT NULL::text, p_supplier text DEFAULT NULL::text,
  p_photo_url text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qty_now  numeric;
  v_avg      numeric;
  v_new_qty  numeric;
  v_unit     numeric;
  v_new_avg  numeric;
  v_base     numeric;
  v_mv_id    uuid;
BEGIN
  IF p_qty IS NULL OR p_qty < 0 THEN
    RAISE EXCEPTION 'BAD_QTY';
  END IF;

  -- FOR UPDATE is the whole point: it serialises movements per material (BUG32).
  SELECT qty_current, cost_per_unit INTO v_qty_now, v_avg
  FROM stock_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF p_type = 'in' THEN
    v_new_qty := v_qty_now + p_qty;
    v_unit    := COALESCE(p_unit_cost, v_avg);
    v_base    := GREATEST(COALESCE(v_qty_now, 0), 0);
    IF (v_base + p_qty) > 0 THEN
      v_new_avg := ROUND((v_base * COALESCE(v_avg, 0) + p_qty * v_unit) / (v_base + p_qty), 4);
    ELSE
      v_new_avg := v_unit;
    END IF;
  ELSIF p_type = 'out' THEN
    v_new_qty := v_qty_now - p_qty;
    IF v_new_qty < 0 THEN                                   -- ← new in this migration
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', COALESCE(v_qty_now, 0);
    END IF;
    v_unit    := v_avg;
    v_new_avg := v_avg;
  ELSIF p_type = 'adjust' THEN
    v_new_qty := p_qty;          -- absolute new balance, not a change (BUG34)
    v_unit    := v_avg;
    v_new_avg := v_avg;
  ELSE
    RAISE EXCEPTION 'BAD_TYPE';
  END IF;

  INSERT INTO stock_movements
    (item_id, movement_type, qty, balance_after, unit_cost,
     ref_type, ref_id, note, created_by, doc_no, supplier, photo_url)
  VALUES
    (p_item_id, p_type, p_qty, v_new_qty, v_unit,
     CASE WHEN COALESCE(p_po_number,'') <> '' THEN 'po' ELSE 'manual' END,
     NULLIF(p_po_number,''), p_note, p_created_by,
     NULLIF(p_doc_no,''), NULLIF(p_supplier,''), NULLIF(p_photo_url,''))
  RETURNING id INTO v_mv_id;

  UPDATE stock_items
     SET qty_current   = v_new_qty,
         cost_per_unit = v_new_avg,
         updated_at    = now()
   WHERE id = p_item_id;

  RETURN json_build_object(
    'movement_id',   v_mv_id,
    'balance_after', v_new_qty,
    'unit_cost',     v_unit,
    'avg_cost',      v_new_avg
  );
END;
$function$;

-- The 7-argument overload predates the delivery-note columns (doc_no/supplier/
-- photo_url) and nothing calls it. Two candidates that both accept a 7-argument
-- named call is how PostgREST ends up returning PGRST203 "could not choose the
-- best candidate function" — remove the dead one before it bites.
DROP FUNCTION IF EXISTS public.apply_stock_movement(uuid, text, numeric, numeric, text, text, text);
