import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const interviewSource = readFileSync(path.join(__dirname, "../src/pages/Interview.jsx"), "utf8");

test("Interview 输入区保留发送按钮且不再使用绝对定位语音按钮", () => {
  assert.match(interviewSource, /const canSendChat = Boolean\(input\.trim\(\)\) && !sending && !finished;/);
  assert.match(interviewSource, /onClick=\{handleSend\}/);
  assert.match(interviewSource, /发送回应/);
  assert.match(interviewSource, /Enter 发送 · Shift\+Enter 换行/);
  assert.doesNotMatch(interviewSource, /absolute right-5 bottom-5 p-2\.5 border transition-all/);
});
