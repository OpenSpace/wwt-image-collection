import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "fs";
import node_fetch from 'node-fetch';
import xml2js from 'xml2js';
import crypto from 'crypto';

async function readWtml(uri: string): Promise<string> {
  let isFile = existsSync(uri) && lstatSync(uri).isFile();
  console.log(`Reading ${uri}: ${isFile ? 'File' : 'URL'}`);

  let content = '';
  if (isFile) {
    content = readFileSync(uri).toString();
  }
  else {
    content = await (await node_fetch(uri)).text();
  }

  let data = await xml2js.parseStringPromise(content);
  if (!('Folder' in data)) {
    console.error(`Could not find root <Folder> in ${uri}`);
    process.exit(-1);
  }

  let root = data.Folder;
  if ('Folder' in root) {
    let folders = root.Folder;
    for (let f of folders) {
      let entry = f['$'];

      if ('Url' in entry) {
        content += await readWtml(entry.Url);
      }
    }
  }

  return content;
}

export async function main() {
  if (!existsSync('hashgen')) {
    console.error('Hashgen must be started with wwt-image-collection begin the current working directory');
    process.exit(-1);
  }

  let versions = readdirSync('.').filter((v) => Number(v));
  for (let version of versions) {
    let contents = '';
    let files = readdirSync(version).filter((v) => lstatSync(`${version}/${v}`).isFile());
    for (let file of files) {
      if (file === 'hash.md5') {
        continue;
      }
      contents = contents + await readWtml(`${version}/${file}`);
    }

    let hash = crypto.createHash('md5').update(contents).digest('base64');
    writeFileSync(`${version}/hash.md5`, hash);
  }
}

