import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Initial Schema Migration
 *
 * Creates all core tables for AI Sandbox Platform:
 * - users: User accounts
 * - sessions: Container sessions
 * - containers: Docker containers
 * - conversations: Chat conversations
 * - chat_messages: Chat messages
 * - git_checkpoints: Git commits
 * - token_usage: Token tracking (legacy)
 * - usage_records: Billing usage ledger (Phase 22B)
 * - billing_snapshots: Billing snapshots (Phase 23B)
 * - invoices: Invoice records (Phase 25B)
 */
export class InitialSchema1770461376029 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create users table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id UUID PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        // Create sessions table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(user_id),
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);

        // Create containers table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS containers (
                container_id UUID PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES sessions(session_id),
                docker_container_id VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_containers_session_id ON containers(session_id)`);

        // Create conversations table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                conversation_id UUID PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES sessions(session_id),
                title VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id)`);

        // Create chat_messages table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                message_id UUID PRIMARY KEY,
                conversation_id UUID NOT NULL REFERENCES conversations(conversation_id),
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)`);

        // Create git_checkpoints table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS git_checkpoints (
                checkpoint_id UUID PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES sessions(session_id),
                commit_hash VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_git_checkpoints_session_id ON git_checkpoints(session_id)`);

        // Create token_usage table (legacy)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS token_usage (
                usage_id UUID PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES sessions(session_id),
                tokens_used INTEGER NOT NULL,
                model VARCHAR(100) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id)`);

        // Create usage_records table (Phase 22B: CRITICAL for StartupGuard)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS usage_records (
                execution_id UUID PRIMARY KEY,
                api_key_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                session_id UUID NOT NULL,
                conversation_id UUID NOT NULL,
                provider VARCHAR(50) NOT NULL,
                adapter VARCHAR(50) NOT NULL,
                model VARCHAR(100) NOT NULL,
                tokens_used INTEGER NOT NULL,
                execution_duration_ms INTEGER NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                metadata JSONB
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_usage_records_api_key_timestamp ON usage_records(api_key_id, timestamp)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_usage_records_user_timestamp ON usage_records(user_id, timestamp)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp ON usage_records(timestamp)`);

        // Create billing_snapshots table (Phase 23B: CRITICAL for StartupGuard)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS billing_snapshots (
                snapshot_id UUID PRIMARY KEY,
                api_key_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                period_start TIMESTAMP NOT NULL,
                period_end TIMESTAMP NOT NULL,
                period_type VARCHAR(20) NOT NULL,
                pricing_version VARCHAR(50) NOT NULL,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                total_requests INTEGER NOT NULL DEFAULT 0,
                subtotal_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
                adjustments_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
                total_cost_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
                line_items JSONB NOT NULL DEFAULT '[]',
                status VARCHAR(20) NOT NULL DEFAULT 'draft',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_billing_snapshots_api_key_period ON billing_snapshots(api_key_id, period_start, period_end)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_billing_snapshots_user ON billing_snapshots(user_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_billing_snapshots_created_at ON billing_snapshots(created_at)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_billing_snapshots_unique_window ON billing_snapshots(api_key_id, period_start, period_end, pricing_version)`);

        // Create invoices table (Phase 25B: CRITICAL for StartupGuard)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                invoice_id UUID PRIMARY KEY,
                snapshot_id UUID NOT NULL UNIQUE,
                api_key_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                period_start TIMESTAMP NOT NULL,
                period_end TIMESTAMP NOT NULL,
                pricing_version VARCHAR(50) NOT NULL,
                subtotal_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
                adjustments_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
                total_cost_usd DECIMAL(10,3) NOT NULL DEFAULT 0,
                currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                line_items JSONB NOT NULL DEFAULT '[]',
                status VARCHAR(20) NOT NULL DEFAULT 'draft',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_invoices_snapshot_id ON invoices(snapshot_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_invoices_api_key_period ON invoices(api_key_id, period_start, period_end)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order (respecting foreign keys)
        await queryRunner.query(`DROP TABLE IF EXISTS invoices`);
        await queryRunner.query(`DROP TABLE IF EXISTS billing_snapshots`);
        await queryRunner.query(`DROP TABLE IF EXISTS usage_records`);
        await queryRunner.query(`DROP TABLE IF EXISTS token_usage`);
        await queryRunner.query(`DROP TABLE IF EXISTS git_checkpoints`);
        await queryRunner.query(`DROP TABLE IF EXISTS chat_messages`);
        await queryRunner.query(`DROP TABLE IF EXISTS conversations`);
        await queryRunner.query(`DROP TABLE IF EXISTS containers`);
        await queryRunner.query(`DROP TABLE IF EXISTS sessions`);
        await queryRunner.query(`DROP TABLE IF EXISTS users`);
    }

}

