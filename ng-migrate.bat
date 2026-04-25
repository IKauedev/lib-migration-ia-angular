@echo off
setlocal

:: ── Setup shortcut: ng-migrate.bat setup ──────────────────────────────────────
if /i "%1"=="setup" (
  echo.
  echo  Assistente de configuracao de variaveis de ambiente...
  echo.
  node "%~dp0src\index.js" env
  goto :eof
)

:: ── All other commands pass through ──────────────────────────────────────────
node "%~dp0src\index.js" %*
