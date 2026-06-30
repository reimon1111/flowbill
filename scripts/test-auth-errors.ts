/**
 * 認証エラーメッセージ変換・バリデーションの自動テスト
 * 実行: npx tsx scripts/test-auth-errors.ts
 */
import {
  AUTH_USER_MESSAGES,
  createMockAuthError,
  isExpectedAuthError,
  mapAuthErrorToUserMessage,
  toAuthActionFailure,
  validateLoginInput,
  validateSignupInput,
} from "../src/lib/auth/errors";

type TestCase = {
  name: string;
  run: () => boolean;
  expected: string;
};

function assertEqual(actual: string, expected: string, label: string): boolean {
  if (actual !== expected) {
    console.error(`  FAIL: ${label}`);
    console.error(`    expected: ${expected}`);
    console.error(`    actual:   ${actual}`);
    return false;
  }
  return true;
}

const loginValidationTests: TestCase[] = [
  {
    name: "ログイン: メール空欄",
    run: () =>
      assertEqual(
        validateLoginInput("", "pass") ?? "",
        AUTH_USER_MESSAGES.emailRequired,
        "email empty"
      ),
    expected: AUTH_USER_MESSAGES.emailRequired,
  },
  {
    name: "ログイン: パスワード空欄",
    run: () =>
      assertEqual(
        validateLoginInput("a@b.com", "") ?? "",
        AUTH_USER_MESSAGES.passwordRequired,
        "password empty"
      ),
    expected: AUTH_USER_MESSAGES.passwordRequired,
  },
  {
    name: "ログイン: メール形式不正",
    run: () =>
      assertEqual(
        validateLoginInput("not-an-email", "pass") ?? "",
        AUTH_USER_MESSAGES.emailInvalidFormat,
        "invalid email"
      ),
    expected: AUTH_USER_MESSAGES.emailInvalidFormat,
  },
  {
    name: "ログイン: 正常入力",
    run: () => validateLoginInput("user@example.com", "password") === null,
    expected: "null",
  },
];

const signupValidationTests: TestCase[] = [
  {
    name: "サインアップ: 必須未入力",
    run: () =>
      assertEqual(
        validateSignupInput("", "", "") ?? "",
        AUTH_USER_MESSAGES.validationFailed,
        "all empty"
      ),
    expected: AUTH_USER_MESSAGES.validationFailed,
  },
  {
    name: "サインアップ: パスワード短い",
    run: () =>
      assertEqual(
        validateSignupInput("a@b.com", "short", "short") ?? "",
        AUTH_USER_MESSAGES.passwordTooShort,
        "short password"
      ),
    expected: AUTH_USER_MESSAGES.passwordTooShort,
  },
  {
    name: "サインアップ: 確認不一致",
    run: () =>
      assertEqual(
        validateSignupInput("a@b.com", "password1", "password2") ?? "",
        AUTH_USER_MESSAGES.passwordMismatch,
        "mismatch"
      ),
    expected: AUTH_USER_MESSAGES.passwordMismatch,
  },
  {
    name: "サインアップ: 正常入力",
    run: () =>
      validateSignupInput("user@example.com", "password123", "password123") ===
      null,
    expected: "null",
  },
];

const mappingTests: TestCase[] = [
  {
    name: "Supabase: Invalid login credentials",
    run: () =>
      assertEqual(
        mapAuthErrorToUserMessage(
          createMockAuthError("Invalid login credentials", "invalid_credentials"),
          "login"
        ),
        AUTH_USER_MESSAGES.loginInvalidCredentials,
        "invalid credentials"
      ),
    expected: AUTH_USER_MESSAGES.loginInvalidCredentials,
  },
  {
    name: "Supabase: 既に登録済み",
    run: () =>
      assertEqual(
        mapAuthErrorToUserMessage(
          createMockAuthError("User already registered", "user_already_exists"),
          "signup"
        ),
        AUTH_USER_MESSAGES.signupAlreadyRegistered,
        "already registered"
      ),
    expected: AUTH_USER_MESSAGES.signupAlreadyRegistered,
  },
  {
    name: "Supabase: 弱いパスワード",
    run: () =>
      assertEqual(
        mapAuthErrorToUserMessage(
          createMockAuthError("Password should be at least 8 characters", "weak_password"),
          "signup"
        ),
        AUTH_USER_MESSAGES.passwordTooShort,
        "weak password"
      ),
    expected: AUTH_USER_MESSAGES.passwordTooShort,
  },
  {
    name: "toAuthActionFailure: ok:false を返す",
    run: () => {
      const result = toAuthActionFailure(
        createMockAuthError("Invalid login credentials"),
        "login",
        "test"
      );
      return (
        result.ok === false &&
        result.message === AUTH_USER_MESSAGES.loginInvalidCredentials &&
        result.rawError !== undefined
      );
    },
    expected: "ok:false with Japanese message",
  },
  {
    name: "isExpectedAuthError: ログイン失敗は想定内",
    run: () =>
      isExpectedAuthError(
        createMockAuthError("Invalid login credentials", "invalid_credentials")
      ),
    expected: "true",
  },
  {
    name: "isExpectedAuthError: 通信エラーは想定外",
    run: () => !isExpectedAuthError(new TypeError("Failed to fetch")),
    expected: "true",
  },
];

const allTests = [...loginValidationTests, ...signupValidationTests, ...mappingTests];

let passed = 0;
let failed = 0;

console.log("=== 認証エラーハンドリング 自動テスト ===\n");

for (const test of allTests) {
  const ok = test.run();
  if (ok) {
    passed += 1;
    console.log(`✓ ${test.name}`);
  } else {
    failed += 1;
    console.log(`✗ ${test.name}`);
  }
}

console.log(`\n結果: ${passed} 成功 / ${failed} 失敗 / ${allTests.length} 件`);

if (failed > 0) {
  process.exit(1);
}

console.log("\n=== 手動E2E確認が必要な項目 ===");
console.log("- 登録済み/未登録メールでの実際の Supabase ログイン");
console.log("- 許可済み/未許可メールでのサインアップ");
console.log("- 招待URLからのメンバー登録");
console.log("- Next.js dev overlay が出ないこと（ブラウザ確認）");
