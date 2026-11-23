/**
 * First-run setup rules, mirrored from the account service so mistakes show
 * before a request: nicknames are 1–32 characters without control characters;
 * passwords are 6–32 characters and at most 72 UTF-8 bytes.
 */
const CONTROL = /\p{Cc}/u;

export function nicknameProblem(value: string): string | undefined {
  const nickname = value.trim();
  if (!nickname) return "请输入昵称。";
  if ([...nickname].length > 32) return "昵称最多 32 个字符。";
  if (CONTROL.test(nickname)) return "昵称不能包含控制字符。";
  return undefined;
}

export function passwordProblem(password: string, confirmation: string): string | undefined {
  const length = [...password].length;
  if (length < 6 || length > 32) return "密码需为 6–32 个字符。";
  if (new TextEncoder().encode(password).length > 72) return "密码过长，请减少中文或特殊字符。";
  if (password !== confirmation) return "两次输入的密码不一致。";
  return undefined;
}
