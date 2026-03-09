-- TASK-56C/56D: Seed TypeORM migrations table for baseline covered by init SQL
-- Runs after 002, 004, 100, 101. Ensures TypeORM skips migrations already applied by init.
-- All billing/usage/invoice tables created by init; no migrations run at api-gateway startup.

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO migrations (timestamp, name) VALUES
  (1738843200000, 'CreateUsageRecordsTable1738843200000'),
  (1738843300000, 'CreateBillingSnapshotsTable1738843300000'),
  (1740355200000, 'AddRequestIdToUsageRecords1740355200000'),
  (1740355300000, 'AddExecutionStatusToUsageRecords1740355300000'),
  (1738900000000, 'CreateInvoicesTable1738900000000'),
  (1769160618009, 'InitSchema202601231769160618009'),
  (1771494478022, 'AddSessionTermination1771494478022'),
  (1771495000000, 'AddExecutionStatusCancelStates1771495000000')
ON CONFLICT (name) DO NOTHING;
