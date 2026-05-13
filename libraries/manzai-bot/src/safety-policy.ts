const unsafePatterns = [
  /미성년|아동|초등학생|중학생|minor|underage/i,
  /자살|자해|죽고\s*싶|self[-\s]?harm|suicide/i,
  /주소\s*공개|전화번호|주민등록|doxx|doxing/i,
  /비밀번호|password|api[_-\s]?key|access[_-\s]?token|refresh[_-\s]?token|credential/i,
  /마약\s*제조|폭탄\s*제조|해킹\s*방법|illegal instructions|make a bomb/i,
  /괴롭히|혐오|죽여|harass|hate speech/i
];

export interface SafetyDecision {
  safe: boolean;
  reason?: string;
}

export function evaluateViewerMessageSafety(message: string): SafetyDecision {
  const normalized = message.trim();
  if (normalized.length === 0) {
    return { safe: false, reason: "empty" };
  }

  for (const pattern of unsafePatterns) {
    if (pattern.test(normalized)) {
      return { safe: false, reason: "unsafe-topic" };
    }
  }

  return { safe: true };
}

export function sanitizeBotLine(line: string, maxPreferredLength: number): string {
  const withoutIdentityClaims = line
    .replace(/저는\s*사람이에요/g, "저는 도구예요")
    .replace(/나\s*사람이야/g, "나 봇이야")
    .replace(/시청자인데/g, "봇인데")
    .trim();

  if (withoutIdentityClaims.length <= maxPreferredLength) {
    return withoutIdentityClaims;
  }

  return withoutIdentityClaims.slice(0, Math.max(0, maxPreferredLength - 1)).trimEnd();
}
