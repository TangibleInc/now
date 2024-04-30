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
    path: testsFolder,
    silence: true
  }))

  ok(true, 'starts')

  let result = await (await fetch(`http://localhost:${wpEnvOptions.port}`)).text()
  let expected = '<!doc'
  is(expected, result.slice(0, expected.length).toLowerCase(), 'responds with HTML document')

  result = await (await fetch(`http://localhost:${wpEnvOptions.port}/wp-content/test/php-version.php`)).text()
  expected = 'php version'
  is(expected, result.slice(0, expected.length).toLowerCase(), 'run test file from mounted local folder')
  console.log(result)

})

run()
