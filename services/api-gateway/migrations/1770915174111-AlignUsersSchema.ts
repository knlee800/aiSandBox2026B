import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Phase 36A: Schema Alignment Fix
 * 
 * Aligns users table schema with User entity definition.
 * 
 * ADDITIVE ONLY - No destructive operations.
 * 
 * Missing columns to add:
 * - auth_provider
 * - oauth_id
 * - plan_type
 * - stripe_customer_id
 * - last_login_at
 * - is_active
 * 
 * Column name fixes:
 * - user_id → id (rename primary key)
 */
export class AlignUsersSchema1770915174111 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if users table exists
        const hasUsersTable = await queryRunner.hasTable('users');
        if (!hasUsersTable) {
            throw new Error('users table does not exist. Run InitialSchema migration first.');
        }

        // Rename user_id to id (if needed)
        const table = await queryRunner.getTable('users');
        const hasUserId = table?.columns.find(col => col.name === 'user_id');
        const hasId = table?.columns.find(col => col.name === 'id');
        
        if (hasUserId && !hasId) {
            await queryRunner.renameColumn('users', 'user_id', 'id');
        }

        // Make password_hash nullable (OAuth users don't have passwords)
        const passwordHashColumn = table?.columns.find(col => col.name === 'password_hash');
        if (passwordHashColumn && !passwordHashColumn.isNullable) {
            await queryRunner.changeColumn('users', 'password_hash', new TableColumn({
                name: 'password_hash',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }));
        }

        // Add auth_provider column if missing
        const hasAuthProvider = table?.columns.find(col => col.name === 'auth_provider');
        if (!hasAuthProvider) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'auth_provider',
                type: 'varchar',
                length: '50',
                default: "'email'",
                isNullable: false,
            }));
        }

        // Add oauth_id column if missing
        const hasOauthId = table?.columns.find(col => col.name === 'oauth_id');
        if (!hasOauthId) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'oauth_id',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }));
        }

        // Add plan_type column if missing
        const hasPlanType = table?.columns.find(col => col.name === 'plan_type');
        if (!hasPlanType) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'plan_type',
                type: 'varchar',
                length: '50',
                default: "'free'",
                isNullable: false,
            }));
        }

        // Add stripe_customer_id column if missing
        const hasStripeCustomerId = table?.columns.find(col => col.name === 'stripe_customer_id');
        if (!hasStripeCustomerId) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'stripe_customer_id',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }));
        }

        // Add is_active column if missing
        const hasIsActive = table?.columns.find(col => col.name === 'is_active');
        if (!hasIsActive) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'is_active',
                type: 'boolean',
                default: true,
                isNullable: false,
            }));
        }

        // Add last_login_at column if missing
        const hasLastLoginAt = table?.columns.find(col => col.name === 'last_login_at');
        if (!hasLastLoginAt) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'last_login_at',
                type: 'timestamp',
                isNullable: true,
            }));
        }

        // Update existing sessions table to reference correct column name
        // Check if sessions.user_id exists and needs to be updated
        const hasSessionsTable = await queryRunner.hasTable('sessions');
        if (hasSessionsTable) {
            const sessionsTable = await queryRunner.getTable('sessions');
            const hasSessionUserId = sessionsTable?.columns.find(col => col.name === 'user_id');
            
            // Drop and recreate foreign key constraint if needed
            if (hasSessionUserId) {
                // Drop existing foreign key if it exists
                const foreignKeys = sessionsTable?.foreignKeys.filter(fk => 
                    fk.columnNames.includes('user_id')
                );
                
                for (const fk of foreignKeys || []) {
                    await queryRunner.dropForeignKey('sessions', fk);
                }

                // Recreate foreign key with correct reference
                await queryRunner.query(`
                    ALTER TABLE sessions 
                    ADD CONSTRAINT fk_sessions_user_id 
                    FOREIGN KEY (user_id) 
                    REFERENCES users(id) 
                    ON DELETE CASCADE
                `);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove added columns in reverse order
        const table = await queryRunner.getTable('users');
        
        if (table?.columns.find(col => col.name === 'last_login_at')) {
            await queryRunner.dropColumn('users', 'last_login_at');
        }
        
        if (table?.columns.find(col => col.name === 'is_active')) {
            await queryRunner.dropColumn('users', 'is_active');
        }
        
        if (table?.columns.find(col => col.name === 'stripe_customer_id')) {
            await queryRunner.dropColumn('users', 'stripe_customer_id');
        }
        
        if (table?.columns.find(col => col.name === 'plan_type')) {
            await queryRunner.dropColumn('users', 'plan_type');
        }
        
        if (table?.columns.find(col => col.name === 'oauth_id')) {
            await queryRunner.dropColumn('users', 'oauth_id');
        }
        
        if (table?.columns.find(col => col.name === 'auth_provider')) {
            await queryRunner.dropColumn('users', 'auth_provider');
        }

        // Revert password_hash to NOT NULL
        await queryRunner.changeColumn('users', 'password_hash', new TableColumn({
            name: 'password_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
        }));

        // Rename id back to user_id
        const hasId = table?.columns.find(col => col.name === 'id');
        if (hasId) {
            await queryRunner.renameColumn('users', 'id', 'user_id');
        }
    }

}
