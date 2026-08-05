# CLAUDE.md (OLQ rental-slip-app)

## Non-negotiables（雄太の承認なしに変更・削除しない）
- OLQは機材レンタル会社でなく「撮影成功率」を売る会社。判断・信頼が堀、速度はその倍率。
- 1バグ = 1修正 + 1規律1行 + 1実機検証。「動いた」でなく「役に立った」で完了。
- 編集前にSupabaseの列・環境変数の実在を確認。存在しない列で結果がnull化し後続が静かに死ぬ。
- RLS / 認証 / セキュリティ / テーブル構造 / 設計判断に触れる時は、コードで直す前にOpusパケットを出して止まる。自己判断で進めない。
- env値・秘密情報は絶対に出力しない。
- 管理系エンドポイント（/send-faq-reply等）は必ず olq-sync-worker.y-inoue-567.workers.dev。faq.olqrental.com は公開系のみ。
- AIは雄太の判断を超えて勝手に進めない。初回承認は自動化しない。
- knowledge削除はソフト削除（deleted_at）。ハード削除しない＝判断資産を不可逆に消さない。

## Known risks（直すたびに1行追記。診断済み4バグ）
- Bug①メール届かない＝approveWithEditのselectに存在しないtype列→kData null→送信スキップ（コード）
- Bug②削除が戻る＝knowledge DELETE用RLSポリシー不在→0行削除・無エラー→再描画で復活（DB/RLS・直さない）
- Bug③内部タブ＝is_internalとpublic_statusの二重フィールド不整合（設計判断）
- Bug④FAQ高さ＝EC埋め込みHTMLのCSS（別物）
- WorkerはService Keyを使いRLSが適用されない。FAQ系knowledgeクエリには必ず deleted_at=is.null を付ける（漏れると削除済みFAQが公開・クローラーに露出する）。
- 管理系POSTは必ず VITE_WORKER_URL（olq-sync-worker.y-inoue-567.workers.dev）。faq.olqrental.com は /send-faq-reply を302で殺す。
- VITE_* 変数はCloudflare Pages の「変数とシークレット」に登録する。.env.local はgit管理外でCloudflareビルドに届かない。
- 外部fetchは必ずtry-catchとstatus/bodyのログで無音失敗を作らない。

## 読み取り専用DB接続（claude_readonly）
- 調査でDBの中身を読むときは以下のcurlを使う。書き込み（POST/PATCH/DELETE）はこの経路でも一切禁止。
- service keyでの調査読みは廃止済み（service keyは箱の読み書き=context.sh専用）。
  ```
  source ~/olq-sync-worker/.dev.vars
  ANON_KEY=$(grep '^VITE_SUPABASE_ANON_KEY' ~/olq-app/.env.local | cut -d= -f2)
  BASE="${SUPABASE_URL}/rest/v1"
  AUTH=(-H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${CLAUDE_READONLY_JWT}")
  curl -s "${BASE}/テーブル名?select=列&条件" "${AUTH[@]}"
  ```
- 読めるテーブル（8つ）: cases・customers・products・invoices・design_decisions・current_state・design_overview・ai_activity_log
- それ以外（oauth_tokens・financials・bruno_logs・council_weekly・council_replies・email_inbox・line_messages等）は見えない＝403が正常。必要になったら雄太に相談（GRANT SELECT+claude_select_ポリシーの2点セット追加）。
- pg_catalog等のメタ情報はRESTでは読めない。必要なら雄太にSQL Editor実行を1つずつ依頼。
- env値・JWT・キーの値は絶対に出力しない。
- JWT期限: 2027-08-05。切れたら .dev.vars の古いCLAUDE_READONLY_JWT行を消してから bash ~/olq-sync-worker/mint-readonly-jwt.sh で再鋳造。
- 新テーブルはclaude_readonlyから既定で見えない（fail closed・DEFACL対象外）。見せる場合のみGRANT+ポリシーの2点セット。
- レガシーJWT鍵を将来無効化するとこのJWTも死ぬ（service keyも同時に死ぬためcontext.shの故障で気づける）。

## Opus確認パケット（【止まる】時に出す形）
現状1段落 / 確認点1つ / 暫定案+迷い / 関連ロック事項

## あとで（今は作らない）
ファイル分割・事実の自動生成・Verdent比較＝4バグ解消後。分割時はimport記法を現行docで確認。
