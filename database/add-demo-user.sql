-- Add demo user for testing
-- Email: demo@aisandbox.com
-- Password: demo123 (hashed with bcrypt)

INSERT INTO users (email, password_hash, auth_provider, role, plan_type, is_active)
VALUES (
  'demo@aisandbox.com',
  '$2b$12$EMkNzzhbM9OYHseodQCVc.jNLeYWZA9ibHOkwrj6f.otZS79yc.hS',
  'email',
  'user',
  'free',
  true
) ON CONFLICT (email) DO NOTHING;
