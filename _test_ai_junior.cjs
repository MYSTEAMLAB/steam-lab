const { _electron: electron } = require('playwright')

;(async () => {
  const app = await electron.launch({
    executablePath: 'node_modules/electron/dist/electron.exe',
    args: ['out/main/index.cjs', '--user-data-dir=C:\\Users\\Navneet Kaushik\\AppData\\Roaming\\my-stream-lab']
  })
  const window = await app.firstWindow()
  await window.waitForTimeout(3000)

  const result = await window.evaluate(() => {
    const store = (window).useAppStore
    // Clear any stale persisted ai-junior layout from earlier test runs
    // (this app's real user-data dir persists boardLayouts across launches)
    // so we test a genuine fresh-seed, not leftover corrupted state.
    store.setState(state => ({ boardLayouts: { ...state.boardLayouts, 'ai-junior': { devices: [], wires: [] } } }))
    store.getState().setBoard('ai-junior')
    return new Promise((resolve) => {
      setTimeout(() => {
        const state = store.getState()
        const layout = state.boardLayouts['ai-junior']
        resolve({
          devices: layout ? layout.devices.map(d => ({ id: d.id, type: d.type, mappedPin: d.mappedPin })) : null,
          code: state.generatedCode,
          warnings: state.warnings,
          selectedBoardId: state.selectedBoard?.id
        })
      }, 1000)
    })
  })

  console.log('Selected board:', result.selectedBoardId)
  console.log('Seeded devices:', JSON.stringify(result.devices, null, 2))
  console.log('Warnings:', JSON.stringify(result.warnings))
  console.log('=== GENERATED CODE ===')
  console.log(result.code)

  const status = await window.evaluate(async () => await (window).api.mobileServer.start())
  console.log('SERVER:', JSON.stringify(status))
  const compileRes = await fetch(`http://127.0.0.1:${status.port}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pair-Pin': status.pin },
    body: JSON.stringify({ code: result.code, fqbn: 'esp32:esp32:esp32' })
  })
  const compileJson = await compileRes.json()
  console.log('COMPILE SUCCESS:', compileJson.success)
  if (!compileJson.success) console.log('FULL LOG:\n', compileJson.log)
  else console.log('LOG TAIL:', (compileJson.log || '').slice(-300))
  await window.evaluate(async () => await (window).api.mobileServer.stop())

  await app.close()
  process.exit(compileJson.success ? 0 : 1)
})().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
