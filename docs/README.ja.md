# CheeseKit

[한국어](../README.md) | [English](README.en.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md)

CHZZK 配信ツールを安全に試作する Electron アプリと TypeScript ライブラリ群です。`v0.1.0` は**モック CHZZK とモック LLM のみを使う開発用プロトタイプ**で、実際のアカウントやチャットには接続しません。

## 現在動作するもの

- Electron main／preload／React renderer 間の限定 IPC
- 正規化イベントバス、ツール実行、設定・ログ・保存インターフェース
- main 側の送信キュー（既定: 100文字、45秒 cooldown、120秒重複窓、最大10件）
- 一時停止、キュー消去、ツール停止、緊急停止
- 短い韓国語反応を作る `manzai-bot` と単体テスト
- 接続、チャット、送信、エラーを再現するモックアダプター／LLM

## 未実装

実際の CHZZK OAuth、live/session/chat 通信、安全な秘密情報保存、token 更新、OpenAI 実行、配布用 installer はありません。`packages/chzzk-adapter/src/real-todo.ts` の client は意図的に TODO エラーを投げます。実配信の自動化には使わないでください。

## 要件と実行

Node.js 20 以上と `packageManager` 指定の pnpm 11.1.1 が必要です。

```bash
corepack enable
pnpm install
pnpm dev
```

開発画面で `manzai-bot` を有効にし、反応確率と cooldown を調整してモックイベント／キューを確認できます。認証情報は不要です。入力しないでください。

## 検証

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint` は設定未導入のため通知だけを表示する placeholder です。

## 安全性・プライバシー・規約

renderer やツールに token、raw CHZZK client、直接送信権限を渡さない設計です。`manzai-bot` は視聴者や人間を装ってはならず、大量送信用ではありません。将来の実接続では CHZZK 規約、API 制限、rate limit、表示義務、プライバシー法を別途確認してください。現在の安全機構は設計実証であり、実サービスでの遵守や悪用防止を保証しません。詳細は[アーキテクチャ](architecture.md)を参照してください。

## ライセンスと出典表記のお願い

個別のライセンスファイルはありません。公開ソースというだけで複製・変更・再配布できると判断せず、必要な権利を確認してください。紹介または許可された派生利用では `@Bum-Boo` と [元のリポジトリ](https://github.com/Bum-Boo/BumBoo-Cheese-Kit)を記載していただけると幸いです。これは任意のお願いであり、ライセンス義務を追加・代替しません。
