-- 接続先とユーザーを確認
SELECT current_database(), current_user;
-- PostgreSQLでSQLを実行できることを確認
SELECT 1 AS connection_test;
-- DBサーバーの現在日時を確認
SELECT NOW() AS database_time;