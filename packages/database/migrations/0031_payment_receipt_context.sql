ALTER TABLE patient_payments ADD COLUMN receipt_context jsonb;
COMMENT ON COLUMN patient_payments.receipt_context IS 'Historical receipt data captured with new payments. NULL for older records; do not infer historical balances.';
