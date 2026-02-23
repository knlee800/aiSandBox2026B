/**
 * Create Test API Key Script
 * 
 * PHASE-42A-3: Creates a deterministic test API key for verification
 * 
 * Usage:
 *   npx ts-node scripts/create-test-api-key.ts
 * 
 * This script:
 * 1. Connects to the database
 * 2. Creates a test user if not exists
 * 3. Generates an API key using ApiKeyService
 * 4. Outputs the plaintext key (ONLY SHOWN ONCE)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ApiKeyService } from '../src/auth/api-key.service';
import { DataSource } from 'typeorm';
import { User } from '../src/entities/user.entity';
import { UserRole } from '../src/entities/user-role.enum';

const TEST_USER_EMAIL = 'test-user-42a3@example.com';

async function bootstrap() {
  console.log('========================================');
  console.log('PHASE-42A-3: Test API Key Creation');
  console.log('========================================');
  console.log('');

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    // Get services
    const apiKeyService = app.get(ApiKeyService);
    const dataSource = app.get(DataSource);
    const userRepository = dataSource.getRepository(User);

    // Step 1: Ensure test user exists
    console.log('[Step 1] Checking test user...');
    let user = await userRepository.findOne({ where: { email: TEST_USER_EMAIL } });

    if (!user) {
      console.log('  Creating test user...');
      user = userRepository.create({
        email: TEST_USER_EMAIL,
        passwordHash: null, // No password needed for API key auth
        authProvider: 'email',
        role: UserRole.USER,
        planType: 'free',
        isActive: true,
      });
      await userRepository.save(user);
      console.log(`  ✓ Test user created: ${user.id}`);
    } else {
      console.log(`  ✓ Test user exists: ${user.id}`);
    }
    console.log('');

    // Step 2: Create API key
    console.log('[Step 2] Creating API key...');
    const result = await apiKeyService.createApiKey(user.id, [
      'ai:execute',
      'sessions:read',
      'sessions:write',
    ]);

    console.log('  ✓ API key created successfully');
    console.log('');

    // Step 3: Output results
    console.log('========================================');
    console.log('API KEY CREATED');
    console.log('========================================');
    console.log('');
    console.log('⚠️  SAVE THIS KEY NOW - IT WILL NOT BE SHOWN AGAIN');
    console.log('');
    console.log(`API Key:     ${result.apiKey}`);
    console.log(`Key ID:      ${result.id}`);
    console.log(`Key Prefix:  ${result.keyPrefix}`);
    console.log(`User ID:     ${user.id}`);
    console.log(`User Email:  ${user.email}`);
    console.log(`Scopes:      ai:execute, sessions:read, sessions:write`);
    console.log(`Created At:  ${result.createdAt.toISOString()}`);
    console.log('');

    // Step 4: Provide test commands
    console.log('========================================');
    console.log('VERIFICATION COMMANDS');
    console.log('========================================');
    console.log('');
    console.log('PowerShell 5.x Test Command:');
    console.log('');
    console.log('# Create a test session first');
    console.log('$headers = @{');
    console.log(`    "x-api-key" = "${result.apiKey}"`);
    console.log('    "Content-Type" = "application/json"');
    console.log('}');
    console.log('');
    console.log('$sessionBody = @{');
    console.log('    name = "Test Session for Token Quota"');
    console.log('} | ConvertTo-Json');
    console.log('');
    console.log('$session = Invoke-RestMethod -Method Post `');
    console.log('    -Uri "http://localhost:4000/api/sessions" `');
    console.log('    -Headers $headers `');
    console.log('    -Body $sessionBody');
    console.log('');
    console.log('Write-Host "Session ID: $($session.id)"');
    console.log('');
    console.log('# Test AI execution');
    console.log('$conversationId = [guid]::NewGuid().ToString()');
    console.log('');
    console.log('$aiBody = @{');
    console.log('    sessionId = $session.id');
    console.log('    conversationId = $conversationId');
    console.log('    provider = "stub"');
    console.log('    prompt = "Test prompt"');
    console.log('    max_tokens = 1000');
    console.log('} | ConvertTo-Json');
    console.log('');
    console.log('$result = Invoke-RestMethod -Method Post `');
    console.log('    -Uri "http://localhost:4000/api/ai/execute" `');
    console.log('    -Headers $headers `');
    console.log('    -Body $aiBody');
    console.log('');
    console.log('Write-Host "Tokens Used: $($result.tokensUsed)"');
    console.log('');
    console.log('# Run token quota verification script');
    console.log('.\\scripts\\verify-token-quota-42a3.ps1 `');
    console.log('    -BaseUrl "http://localhost:4000" `');
    console.log(`    -TestApiKey "${result.apiKey}"`);
    console.log('');

    console.log('========================================');
    console.log('');

  } catch (error) {
    console.error('Error creating API key:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
