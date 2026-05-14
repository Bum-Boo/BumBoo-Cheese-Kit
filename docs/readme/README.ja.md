# CheeseKit

> Local-first CHZZK livestream tooling runtime with a safe internal bot library.

[Overview](../../README.md) | [English](README.en.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

CheeseKit は、CHZZK ライブ配信用ツールをローカルで安全に実行するためのデスクトップルートアプリです。v0.1 の目的は意図的に狭く、安全なローカルランタイム上で最初の内部ライブラリ `manzai-bot` を動かすことです。

`manzai-bot` はボケ/ツッコミ風の AI チャットツールです。CHZZK API を直接呼び出さず、トークンも読み取らず、ルートアプリが提供する `ToolContext.requestSendChat()` 経由でのみチャット送信を要求します。

### 現在の範囲

- Electron + React + TypeScript デスクトップアプリ
- mock CHZZK adapter による接続とチャットイベント
- ルートアプリが所有する event bus、tool runner、send queue、config、logger
- mock LLM provider
- 100 文字制限、クールダウン、重複メッセージ防止、emergency stop

### 実行

```bash
pnpm install
pnpm dev
```

### デモ手順

1. `pnpm install` を実行します。
2. `pnpm dev` を実行します。
3. `manzai-bot` カードの checkbox をクリックして `ON` にします。
4. `Reaction chance` と `Cooldown seconds` を調整します。
5. 右側の `Send queue` に自動リアクションメッセージが追加されることを確認します。
6. すぐ停止する必要がある場合は `Emergency stop` をクリックします。
