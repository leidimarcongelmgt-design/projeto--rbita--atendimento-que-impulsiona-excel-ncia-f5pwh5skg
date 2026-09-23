import { runClientParserSelfCheck } from './src/lib/clientDataParser.test'

const result = runClientParserSelfCheck()
console.log('Passed:', result.passed)
for (const line of result.results) {
  console.log(' -', line)
}
if (!result.passed) {
  process.exit(1)
}
