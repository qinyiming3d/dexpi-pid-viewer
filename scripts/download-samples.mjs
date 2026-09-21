import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const directory = new URL('../public/samples/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'))
await mkdir(directory, { recursive: true })
for (const sample of manifest) {
  console.log(`Downloading ${sample.file}…`)
  const response = await fetch(sample.downloadUrl, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`${sample.file}: HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.toString('utf8', 0, 2048).includes('<PlantModel')) throw new Error(`${sample.file}: response is not a Proteus PlantModel`)
  const digest = createHash('sha256').update(buffer).digest('hex')
  if (digest !== sample.sha256) throw new Error(`${sample.file}: SHA-256 mismatch; existing file was preserved`)
  await writeFile(new URL(sample.file, directory), buffer)
  console.log(`Saved ${fileURLToPath(new URL(sample.file, directory))} (${buffer.length} bytes, SHA-256 verified)`)
}
