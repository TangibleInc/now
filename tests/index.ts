import path from 'node:path'
import { test, is, ok, run } from 'testra'
import {
  startServer,
  getWpNowConfig
} from '../src/index.ts'
import wpEnv from './.wp-env.json'
import wpEnvOverride from './.wp-env.override.json'

test('wp-now', async () => {

  const wpEnvOptions = Object.assign({}, wpEnv, wpEnvOverride)

  const testsFolder = process.cwd() // path.join(process.cwd(), 'tests')
  await startServer(await getWpNowConfig({
    path: testsFolder
  }))

  ok(true, 'starts')

  const result = await (await fetch(`http://localhost:${wpEnvOptions.port}`)).text()

  is('<!doc', result.slice(0, 5).toLowerCase(), 'responds with HTML document')

})

run()
