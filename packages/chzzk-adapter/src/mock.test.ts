import { describe, expect, it } from "vitest";
import { MockChatClient } from "./mock";
import { DisconnectedSessionError, ExpiredTokenError } from "./types";

describe("MockChatClient", () => {
  it("simulates send success and failure modes", async () => {
    const chat = new MockChatClient();
    await chat.sendChat("성공 메시지");
    expect(chat.getSentMessages()).toEqual(["성공 메시지"]);

    chat.setSendMode("failure");
    await expect(chat.sendChat("실패 메시지")).rejects.toThrow("Mock CHZZK chat send failure");

    chat.setSendMode("expired-token");
    await expect(chat.sendChat("토큰 만료")).rejects.toBeInstanceOf(ExpiredTokenError);

    chat.setSendMode("disconnected");
    await expect(chat.sendChat("연결 끊김")).rejects.toBeInstanceOf(DisconnectedSessionError);
  });
});
