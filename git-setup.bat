@echo off
echo GitHubリポジトリへのプッシュ手順
echo.
echo 1. GitHubでリポジトリを作成してください: https://github.com/new
echo 2. リポジトリ名を入力してください（例: pointlab）
set /p REPO_NAME="リポジトリ名を入力: "
echo.
echo 以下のコマンドを実行します...
echo.
git init
git add .
git commit -m "Initial commit: 個人事業主向けWebサイト"
git branch -M main
git remote add origin https://github.com/poifulhakase/%REPO_NAME%.git
git push -u origin main
echo.
echo 完了しました！
pause

