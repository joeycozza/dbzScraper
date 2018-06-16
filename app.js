'use strict';
const _ = require('lodash');
const fs = require('fs-extra');
const cheerio = require('cheerio');
const BPromise = require('bluebird');
const download = require('download');
const request = BPromise.promisify(require('request'));

const baseUrl = 'https://www.mangareader.net/dragon-ball-super';
const baseMangaDirectory = 'dbsuper';

main();

async function main() {
  const numChapters = await getNumChapters();

  BPromise.map(
    _.range(1, numChapters + 1),
    async chapter => {
      console.log('chapter: ', chapter);
      const res = await request(`${baseUrl}/${chapter}`);
      const chapterDirectory = `${baseMangaDirectory}/chapter-${chapter}`;
      if (res.statusCode > 299) {
        throw res.statusMessage;
      }

      const numPages = _.get(res.body.match(/<\/select> of (\d+)<\/div>/), '1', 0);
      console.log('numPages: ', numPages);

      await fs.emptyDir(chapterDirectory);
      return await BPromise.map(
        _.range(1, +numPages + 1),
        async pageNum => {
          const res = await request(`${baseUrl}/${chapter}/${pageNum}`);
          const cheer = cheerio.load(res.body);
          const imageUrl = cheer('#img')[0].attribs.src;

          try {
            await download(imageUrl, chapterDirectory, {filename: `${pageNum}.jpg`});
          } catch (err) {
            console.log('err: ', err.message);
            fs.appendFileSync('downloadErrors.txt', `chapter-${chapter} image ${pageNum} failed to download\n`);
          }
          console.log('done!');
        },
        {concurrency: 15}
      );
    },
    {concurrency: 1}
  );
}

async function getNumChapters() {
  const res = await request(baseUrl);
  const cheer = cheerio.load(res.body);
  const listings = cheer('#listing tr').length;

  return listings - 1;
}