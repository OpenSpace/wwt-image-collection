import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "fs";
import crypto from 'crypto';
import node_fetch from 'node-fetch';
import xml2js from 'xml2js';
import { Block, HeaderBlock, SectionBlock, WebClient } from '@slack/web-api';

async function readWtml(uri: string): Promise<string> {
  // The URI is either a file (for one of the root files) or a URL, so we gotta check
  // which it is
  let isFile = existsSync(uri) && lstatSync(uri).isFile();
  console.log(`Reading ${isFile ? 'File' : 'URL'}:  ${uri}`);

  // Load the content of the URI
  let content = isFile ?
    readFileSync(uri).toString() :
    await (await node_fetch(uri)).text();

  // Convert from XML -> JSON
  let data = await xml2js.parseStringPromise(content);
  
  // All of the files ought to have a `Folder` element at the root
  if (!('Folder' in data)) {
    console.error(`Could not find root <Folder> in ${uri}`);
    process.exit(-1);
  }

  // Recurse through all of the Urls contained as parameters in the Folders
  let root = data.Folder;
  if ('Folder' in root) {
    let folders = root.Folder;
    for (let folder of folders) {
      if ('Url' in folder['$']) {
        content += await readWtml(folder['$'].Url);
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

  const token = existsSync('token.txt') ? readFileSync('token.txt').toString() : '';
  let web = new WebClient(token.trim());

  // Filter all of the contents of the directory that are not numbers
  let versions = readdirSync('.').filter((v) => Number(v));
  for (let version of versions) {
    let contents = '';

    // Get all of the WTML files in the folder
    let files = readdirSync(version).filter((v) => v.endsWith('wtml'));

    // Add all of the contents of all files together
    for (let file of files) {
      contents = contents + await readWtml(`${version}/${file}`);
    }

    // Generate a hash to represent that data
    let hash = crypto.createHash('md5').update(contents).digest('base64');
    const path = `${version}/hash.md5`;
    
    // And only save it into the hash.md5 if the hash is different
    let oldHash = '';
    if (existsSync(path)) {
      oldHash = readFileSync(path).toString();
    }

    console.log(hash, oldHash);
    if (hash !== oldHash) {
      console.log(`Writing new hash ${hash} over old ${oldHash}`);
      writeFileSync(path, hash);

      let msg = new Array<Block>();
      msg.push(
        <HeaderBlock>{
          type: 'header',
          text: { type: 'plain_text', text: 'WWT Image Collection' }
        }
      );
      msg.push(
        <SectionBlock>{
          type: 'section',
          text: { type: 'mrkdwn', text: `Updated hash of version ${version}  (http://data.openspaceproject.com/wwt/${version})`}
        }
      );

      await web.chat.postMessage({
        channel: "jenkins",
        text: `WWT-Images:  Updated hash of version ${version}`,
        blocks: msg
      })
    }
  }
}
