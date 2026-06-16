# CLAUDE.md (OLQ rental-slip-app)

## Non-negotiables（雄太の承認なしに変更・削除しない）
- OLQは機材レンタル会社でなく「撮影成功率」を売る会社。判断・信頼が堀、速度はその倍率。
- 1バグ = 1修正 + 1規律1行 + 1実機検証。「動いた」でなく「役に立った」で完了。
- 編集前にSupabaseの列・環境変数の実在を確認。存在しない列で結果がnull化し後続が静かに死ぬ。
- RLS / 認証 / セキュリティ / テーブル構造 / 設計判断に触れる時は、コードで直す前にOpusパケットを出して止まる。自己判断で進めない。
- env値・秘密情報は絶対に出力しない。
- 管理系エンドポイント（/send-faq-reply等）は必ず olq-sync-worker.y-inoue-567.workers.dev。faq.olqrental.com は公開系のみ。
- AIは雄太の判断を超えて勝手に進めない。初回承認は自動化しない。

## Known risks（直すたびに1行追記。診断済み4バグ）
- Bug①メール届かない＝approveWithEditのselectに存在しないtype列→kData null→送信スキップ（コード）
- Bug②削除が戻る＝knowledge DELETE用RLSポリシー不在→0行削除・無エラー→再描画で復活（DB/RLS・直さない）
- Bug③内部タブ＝is_internalとpublic_statusの二重フィールド不整合（設計判断）
- Bug④FAQ高さ＝EC埋め込みHTMLのCSS（別物）

## Opus確認パケット（【止まる】時に出す形）
現状1段落 / 確認点1つ / 暫定案+迷い / 関連ロック事項

## あとで（今は作らない）
ファイル分割・事実の自動生成・Verdent比較＝4バグ解消後。分割時はimport記法を現行docで確認。
