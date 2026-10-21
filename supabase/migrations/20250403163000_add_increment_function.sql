
-- Function to safely increment a counter
CREATE OR REPLACE FUNCTION increment(row_id UUID)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  UPDATE charities
  SET votes = votes + 1
  WHERE id = row_id
  RETURNING votes;
$$;
