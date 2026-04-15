# Gitエラー修正手順

## エラー例
```
error: src refspec main does not match any
error: failed to push some refs to '...'
```

## 解決手順

1. `git init`
2. `git add .`
3. `git commit -m "Initial commit"`
4. `git branch -M main`
5. `git remote add origin https://github.com/poifulhakase/pointlab.git`
6. `git push -u origin main`

Personal Access Token が必要な場合は GitHub でトークンを発行してください。
