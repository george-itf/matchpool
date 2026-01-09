-- Pot Calculation Function
-- Run this in Supabase SQL Editor

-- Function to recalculate season pot from all payments
CREATE OR REPLACE FUNCTION update_season_pot(p_season_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE seasons
  SET pot_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM payments
    WHERE season_id = p_season_id AND status = 'paid'
  )
  WHERE id = p_season_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_season_pot(uuid) TO authenticated;
