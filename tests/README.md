# Test Suite

This directory contains comprehensive tests for all the implemented features in the AI Chat application.

## Test Files

### `setup.ts`
Test utilities and helper functions:
- Database setup and cleanup
- User creation and authentication helpers
- API key creation helpers
- HTTP request utilities

### `auth.test.ts`
Authentication API tests:
- User registration
- User login/logout
- Authentication state checking
- Error handling for invalid credentials

### `api-keys.test.ts`
API Key Management tests:
- List user's API keys
- Create new API keys
- Delete API keys
- Permission validation (users can only access their own keys)

### `chat.test.ts`
Chat API tests:
- Creating new conversations
- Continuing existing conversations
- Streaming responses
- Provider selection
- Custom API key usage

### `free-messages.test.ts`
Free Message Limit tests:
- Free message counter initialization
- Counter increment on each message
- Limit enforcement (5 messages)
- API key bypass functionality
- User data includes free message count

### `conversations.test.ts`
Conversation and Message History tests:
- Listing user conversations
- Retrieving specific conversations
- Message persistence
- Conversation context for AI
- User isolation (users can't access others' conversations)

## Running Tests

### Prerequisites
- Ensure the development server is running: `bun run dev`
- Database should be accessible
- Use a separate database whose name contains `test` for `DATABASE_URL`; the test cleanup refuses to run against the application database
- Environment variables should be configured

### Run all tests
```bash
bun test
```

### Run specific test file
```bash
bun test tests/auth.test.ts
```

### Run tests in watch mode
```bash
bun test --watch
```

## Test Structure

Each test file follows this pattern:
1. `beforeAll` - Setup test database and create test user
2. Test suites grouped by feature
3. Individual test cases with assertions
4. `afterAll` - Cleanup test database

## Notes

- Tests use real HTTP requests to `http://localhost:3000`
- Database is cleaned up before and after each test file
- Each test file creates isolated test users
- Tests may fail if actual API keys are not configured (external API calls)
- Free message limit tests validate the freemium model implementation