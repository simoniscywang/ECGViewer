# ECGViewer

ECGViewer 是一個 full-stack Web application 專案骨架，用於透過 OAuth 2.0 / SMART on FHIR backend service 授權，從 FHIR server 讀取 ECG `Observation` resource JSON，解析符合 TW Core ECG profile 思路的 ECG raw data，並進行視覺化與初步分析。

## 目標

- 依 Patient id、Observation id 查詢指定 ECG Observation。
- 僅在 server-side 與 FHIR server 交換 token 與讀取受保護資料。
- 將 FHIR resource parsing、ECG signal processing、UI rendering 分層，避免醫療資料處理邏輯散落在畫面元件。
- 對大量 ECG sample 使用 downsampling、windowing、typed array 與 worker-friendly API。
- 將安全、測試、code review 與 coding rule 寫入 repo 代理指令。

## Repo 結構

```text
apps/web/              Next.js web app, API routes, ECG viewer UI
packages/fhir/         FHIR Observation parser and profile-aware validation helpers
packages/ecg/          ECG signal model, downsampling, basic analysis
packages/config/       Shared runtime config and validation helpers
docs/                  Architecture, security, testing and FHIR ECG notes
skills/ecgviewer/      Project-specific Codex skill
AGENTS.md              Agent instructions for this repository
AGENT.md               Compatibility pointer to AGENTS.md
```

## 開發指令

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run lint
```

本專案也保留 `pnpm-workspace.yaml`；若你的環境已安裝 pnpm，可使用同等的 `pnpm install`、`pnpm dev`、`pnpm test`。

Next.js 會從 `apps/web/.env.local` 讀取本機環境變數。請以
`apps/web/.env.example` 為範本建立本機設定，且不要提交任何含 secret 的
`.env.local`。

## OAuth / Backend Service 設定

ECGViewer 以 backend service 方式存取 FHIR server。Next.js API route 會在
server side 使用 `FHIR_CLIENT_ID` 與 `FHIR_CLIENT_SECRET` 向
`FHIR_TOKEN_URL` 執行 `client_credentials` token request，前端不會導向 OAuth
server，也不需要 callback URL。

OAuth client 需允許 service account / client credentials flow。建議 scope 使用
server-level read scope，例如 `system/Observation.read`，實際值需依 FHIR server
與 authorization server 設定調整。

## MVP 使用流程

1. 使用者輸入 FHIR server、Patient id、Observation id。
2. Web app 進入 `/viewer`，由 API route 在 server side 處理 FHIR request。
3. API route 使用 backend service credentials 取得或重用 access token。
4. API route 使用 token 讀取 `/Observation/{id}`，並確認 subject 對應 Patient id。
5. `packages/fhir` 解析 Observation component 中的 ECG waveform data。
6. `packages/ecg` 產生繪圖 friendly 的 lead series、downsampled windows 與基礎量測。
7. UI 顯示 lead waveforms、metadata、sampling rate、duration 與初步分析結果。

本 repo 目前提供可擴充的專案骨架與核心 parser/analysis 範例；實際串接特定 FHIR server 時，請先補齊該 server 的 OAuth metadata 與 TW Core ECG profile 實例測試資料。
