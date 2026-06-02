# FitGrowX Alumno Platform - Testing Guide

## Overview

This document describes the testing infrastructure for the FitGrowX alumno platform. The test suite covers unit tests, integration tests, and smoke tests to ensure reliability and quality across all critical user paths.

## Test Structure

### Test Files Organization

```
tests/
├── setup.ts                          # Test environment configuration
├── alumno-offline.test.ts           # IndexedDB queue operations (15 tests)
├── alumno-schemas.test.ts           # Zod validation schemas (47 tests)
├── alumno-flows.test.ts             # User flow validation (25 tests)
├── useFormValidation.test.ts        # Form validation hook (10 tests)
├── useOfflineSync.test.ts           # Offline sync hook (9 tests)
├── useWorkoutSession.test.ts        # Workout session hook (15 tests)
├── alumno-panel-interactions.test.ts # Panel interactions (13 tests)
├── smoke/
│   ├── mp-webhook.test.ts           # MercadoPago webhook integration
│   ├── magic-link.test.ts           # Magic link authentication
│   └── crear-alumno.test.ts         # Student creation flow
```

## Running Tests

### Command Line

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-reload on file changes)
npm test:watch

# Run specific test file
npm test -- useFormValidation.test.ts

# Run tests matching pattern
npm test -- --grep "validates correct data"
```

## Test Coverage

### Unit Tests (101 tests)

#### 1. **Validation Schemas** (47 tests)
**File:** `tests/alumno-schemas.test.ts`

Tests all Zod schemas used in the application:

- **Login Schema** (5 tests)
  - Email format validation
  - DNI format validation (7-8 digits)
  - Password minimum length (6 chars)
  - Error messages

- **Photo Upload Schema** (8 tests)
  - File type validation (JPEG, PNG, WebP)
  - File size limit (10MB)
  - Optional notes field
  - Private flag default value

- **Weight Tracking Schema** (6 tests)
  - Positive weight validation
  - Maximum weight limit (500kg)
  - Exercise name required
  - Optional notes

- **Measurements Schema** (5 tests)
  - Positive weight required
  - Body fat percentage 0-100%
  - Optional waist measurement
  - All optional fields handling

- **Reservation Schema** (4 tests)
  - Class ID required
  - Date format validation (YYYY-MM-DD)
  - Invalid format rejection

- **Payment Schema** (2 tests)
  - Alumno ID required
  - Gym ID required

- **Plan Schema** (5 tests)
  - Plan ID required
  - Billing cycle enum (monthly, quarterly, annual)
  - Invalid cycle rejection

- **Workout Completion Schema** (6 tests)
  - Positive duration required
  - Maximum duration (1440 minutes/24 hours)
  - Optional notes
  - Routine ID required

#### 2. **Form Validation Hook** (10 tests)
**File:** `tests/useFormValidation.test.ts`

Tests the `useFormValidation` hook that wraps Zod schemas:

- Initial state (empty errors, isValid=true, isDirty=false)
- Validate correct data → errors cleared, isValid=true
- Capture validation errors with proper messages
- Validate individual fields with single-field schemas
- Reset state functionality
- Manual error setting with setError()
- Error merging when setting multiple fields
- Nested object validation
- Preserve existing errors when setting new ones

#### 3. **Offline Storage** (15 tests)
**File:** `tests/alumno-offline.test.ts`

Tests IndexedDB-backed offline queue storage:

- Initialize database
- Enqueue requests with auto-generated IDs
- Retrieve queued requests
- Remove requests from queue
- Update retry counts (max 3)
- Clear entire queue
- Preserve request metadata (URL, method, body, headers)
- Store timestamps for each request
- Generate unique IDs
- Handle optional body/headers
- Reinitialize after clearing
- Multiple rapid enqueues

#### 4. **Offline Sync Hook** (9 tests)
**File:** `tests/useOfflineSync.test.ts`

Tests the `useOfflineSync` hook that syncs queued requests:

- Initialize with isSyncing=false, syncedCount=0
- Sync queue on page load when online
- Skip sync when offline
- Trigger sync on online event
- Remove successful requests from queue
- Increment retries on failed requests
- Stop retry increments at max (3)
- Handle 401 responses as successful
- Expose syncQueue method for manual triggering

#### 5. **Workout Session Hook** (15 tests)
**File:** `tests/useWorkoutSession.test.ts`

Tests the `useWorkoutSession` hook for workout tracking:

- Load saved session from localStorage
- Initialize new workout session
- Don't reinitialize if session exists
- Mark series as completed
- Toggle series completion when clicking same index
- Set exercise weight (kg)
- Persist changes to localStorage
- Finalize workout and sync when online
- Finalize offline and mark offline flag
- Flush offline sessions on reconnection
- Enqueue kg tracking
- Flush kg queue to server
- Remove synced kg items from queue
- Handle missing alumno ID gracefully

### Integration Tests (38 tests)

#### 1. **User Flow Tests** (25 tests)
**File:** `tests/alumno-flows.test.ts`

Tests complete user flows and sequences:

- **Authentication Flow**
  - Valid login credentials
  - Invalid email format
  - Invalid DNI format
  - Short password rejection
  - Clear error messages

- **Class Reservation Flow**
  - Valid reservation data
  - Missing clase_id validation
  - Invalid date format
  - Future date acceptance
  - Today's date acceptance
  - Clear error messages

- **Payment Flow**
  - Valid payment data
  - Missing alumno_id rejection
  - Missing gym_id rejection
  - UUID-style ID support

- **Combined Flows**
  - Login → Reserve → Payment sequence
  - Error isolation (one step doesn't break others)
  - Multiple sequential reservations

- **Data Persistence**
  - JSON serialization for all flows

#### 2. **Panel Interaction Tests** (13 tests)
**File:** `tests/alumno-panel-interactions.test.ts`

Tests user interactions within the panel UI:

- **Tab Navigation**
  - Analytics tracking on tab switch
  - State preservation across tabs

- **Class Reservation Interaction**
  - Handle successful reservation
  - Handle reservation failure (409 conflict)
  - Handle network errors

- **Workout Session Interaction**
  - Mark series completion
  - Update kg for exercises

- **Payment Interaction**
  - Initiate payment with proper credentials
  - Handle payment errors

- **Photo Management**
  - Validate and prepare photo upload
  - Handle photo deletion

- **Offline Sync Interaction**
  - Queue request when offline
  - Sync when back online

- **Session Management**
  - Validate session token
  - Handle session expiration
  - Logout and clear session

### Smoke Tests (3+ tests)
**Directory:** `tests/smoke/`

End-to-end tests hitting actual API endpoints:

- `mp-webhook.test.ts` — MercadoPago webhook signature validation
- `magic-link.test.ts` — Magic link authentication flow
- `crear-alumno.test.ts` — Student account creation

## Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| Validation Schemas | 47 | ✅ |
| Hooks (useFormValidation, useOfflineSync, useWorkoutSession) | 34 | ✅ |
| Storage (IndexedDB) | 15 | ✅ |
| User Flows | 25 | ✅ |
| Panel Interactions | 13 | ✅ |
| Smoke Tests | 4+ | ✅ |
| **Total** | **139+** | ✅ |

## Critical Paths Tested

### 1. Authentication
✅ Email & DNI validation
✅ Password strength validation
✅ Error message clarity

### 2. Class Reservation
✅ Date format validation
✅ Class ID validation
✅ Reservation success/failure
✅ Network error handling

### 3. Payment Processing
✅ Payment data validation
✅ Checkout initiation
✅ Credential handling

### 4. Workout Tracking
✅ Session initialization
✅ Series completion tracking
✅ Weight (kg) tracking
✅ Offline persistence
✅ Server sync on reconnection

### 5. Photo Management
✅ File type validation
✅ Size limit enforcement
✅ Metadata handling
✅ Deletion confirmation

### 6. Offline Functionality
✅ Request queueing when offline
✅ Queue persistence in IndexedDB
✅ Automatic sync on reconnection
✅ Retry logic with backoff
✅ Network error handling

### 7. Error Handling
✅ Form validation errors
✅ API error responses (409, 500, etc.)
✅ Network connectivity loss
✅ Session expiration
✅ User-friendly error messages

## Dependencies

### Testing Framework
- **vitest** ^4.1.7 — Fast unit test framework
- **@testing-library/react** ^16.3.2 — React component testing utilities
- **@testing-library/dom** ^10.4.1 — DOM testing utilities

### Mocking
- **fake-indexeddb** — IndexedDB implementation for unit tests
- **@vitejs/plugin-react** — React plugin for Vitest

### Configuration
- **jsdom** — Browser environment simulation
- **typescript** ^5 — Type safety

## Configuration Files

### `vitest.config.ts`
```typescript
- environment: "jsdom" (browser simulation)
- globals: true (global test functions)
- setupFiles: ["tests/setup.ts"] (test environment setup)
- alias: "@" points to project root
```

### `tests/setup.ts`
```typescript
- Imports fake-indexeddb/auto for IndexedDB mocking
- Sets environment variables for tests
- Provides Supabase, MercadoPago test credentials
```

## Best Practices

### Writing Tests
1. **Use safeParse** for non-critical validation tests (doesn't throw)
2. **Use parse** for hook tests where exceptions matter
3. **Mock external dependencies** (fetch, localStorage, indexedDB)
4. **Test both happy path and error cases**
5. **Keep tests focused** on one concern per test

### Test Organization
1. **Group related tests** with `describe` blocks
2. **Use descriptive test names** that explain intent
3. **Setup/teardown with beforeEach/afterEach**
4. **Avoid test interdependencies**

### Naming Conventions
- Test files: `[module].test.ts` or `[component].test.ts`
- Test directories: `tests/` at project root
- Test suites: Describe the unit being tested
- Test cases: Describe the behavior being verified

## Coverage Gaps & Future Work

### Currently Not Tested
- ❌ Component snapshot testing (UI consistency)
- ❌ Performance benchmarks
- ❌ Visual regression testing
- ❌ Accessibility (a11y) testing
- ❌ E2E UI tests (Playwright/Cypress)
- ❌ Load testing

### Recommended Next Steps
1. **Add snapshot tests** for key components
2. **Setup coverage reports** (vitest coverage-v8 ready)
3. **Add accessibility tests** with jest-axe
4. **Create E2E tests** with Playwright or Cypress
5. **Setup CI/CD integration** to run tests on every PR

## Troubleshooting

### Common Issues

**IndexedDB not found**
- Solution: Ensure `tests/setup.ts` includes `import "fake-indexeddb/auto"`

**React state updates not reflected**
- Solution: Wrap setState calls in `act()` from testing library

**Tests timeout**
- Solution: Increase timeout with `it("test", async () => {...}, 10000)` or use `waitFor` with longer timeout

**Mock not working**
- Solution: Clear mocks with `vi.clearAllMocks()` in `afterEach`

## Contributing Tests

When adding new features:
1. Write unit tests for validation/state logic
2. Write integration tests for user flows
3. Add smoke tests for critical paths
4. Update this TESTING.md with new test descriptions
5. Ensure all tests pass before submitting PR

## Running in CI/CD

```bash
# GitHub Actions example
- name: Run tests
  run: npm test

- name: Coverage report
  run: npm test -- --coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/react)
- [Zod Validation](https://zod.dev/)
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
