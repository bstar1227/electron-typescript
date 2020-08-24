/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
import dayjs, { Dayjs } from 'dayjs';
import path from 'path';
import Async from 'async';
import fs from 'fs';
import { BrowserWindow } from 'electron';

import { VGeoPoint, VGeoPointModel } from '../types/VGeoPoint';
import { IGeoPoint } from '../types/IGeoPoint';
import { sendPoints, sendToClient, errorHandler } from './utils';
import { calculatePoints } from './image';

const ffmpeg = require('ffmpeg');

const { Tags, ExifTool, exiftool } = require('exiftool-vendored');

export function getSeconds(timeStr: string) {
  const re = /(\d+\.?\d*) s/g;
  const m = re.exec(timeStr);

  if (m) {
    return parseInt(m[1], 10);
  }
  const secs = timeStr.split(':');
  return (
    parseInt(secs[0], 10) * 3600 +
    parseInt(secs[1], 10) * 60 +
    parseInt(secs[2], 10)
  );
}

export function dms2dd(
  degrees: string,
  minutes: string,
  seconds: string,
  direction: string
) {
  let dd =
    parseFloat(degrees) +
    parseFloat(minutes) / 60 +
    parseFloat(seconds) / (60 * 60);
  if (direction === 'E' || direction === 'N') {
    dd *= -1;
  }
  return dd;
}

export function parseDms(dms: string | number) {
  if (typeof dms === 'number') {
    return dms;
  }
  const parts = dms.split(/[deg'"]+/g);
  return dms2dd(parts[0], parts[1], parts[2], parts[3]);
}

export function getAltudeMeters(atlStr: string) {
  const re = /(\d+\.?\d*)/g;
  const m = re.exec(atlStr);
  if (m) return parseInt(m[1], 10);
  return 0.0;
}

export function getGPSVideoData(tags: typeof Tags) {
  const re = /(Doc\d+):GPSLatitude/g;

  const tagsText = JSON.stringify(tags);
  const availableKeys = [];
  let m;
  do {
    m = re.exec(tagsText);
    if (m) {
      availableKeys.push(m[1]);
    }
  } while (m);

  console.log('availableKeys: ', availableKeys);

  const dataList: VGeoPoint[] = [];
  availableKeys.forEach((k: string) => {
    try {
      const sampleTime = getSeconds(tags[`${k}:SampleTime`]);
      if (
        dataList.filter((s: VGeoPointModel) => s.SampleTime === sampleTime)
          .length === 0
      ) {
        const item = new VGeoPoint({
          GPSDateTime: dayjs(tags[`${k}:GPSDateTime`]),
          MAPLatitude: parseDms(tags[`${k}:GPSLatitude`]),
          MAPLongitude: parseDms(tags[`${k}:GPSLongitude`]),
          MAPAltitude: getAltudeMeters(tags[`${k}:GPSAltitude`]),
          SampleTime: sampleTime,
        });
        dataList.push(item);
      }
    } catch (e) {
      console.error('Available KEY Error: ', e);
    }
  });

  dataList.sort((firstItem: VGeoPoint, secondItem: VGeoPoint) => {
    return firstItem.SampleTime - secondItem.SampleTime;
  });

  const commonData = Object.keys(tags)
    .filter((k: string) => !k.startsWith('Doc'))
    .reduce((obj, key: string) => {
      obj[key] = tags[key];
      return obj;
    }, {});

  return {
    dataList,
    commonData,
  };
}

export async function writeTags2Image(
  outputPath: string,
  commonData: any,
  datalist: VGeoPoint[],
  callback: any
) {
  const strStartTime = commonData['Main:GPSDateTime'];
  const duration = Math.ceil(commonData['Main:Duration']);
  let starttime: Dayjs;
  if (strStartTime) {
    starttime = dayjs(strStartTime);
  } else {
    starttime = datalist[0].GPSDateTime;
  }
  const result: IGeoPoint[] = [];

  Async.each(
    Array.from({ length: duration }, (_, index) => index),
    (seconds: number, cb: any) => {
      let previtem = null;
      let nextitem = null;
      const datetime = starttime.add(seconds, 'second');
      for (let i = 0; i < datalist.length - 1; i += 1) {
        const item1 = datalist[i];
        const item2 = datalist[i + 1];
        if (item1.SampleTime <= seconds && item2.SampleTime > seconds) {
          previtem = item1;
          nextitem = item2;
        }
      }
      const filename = `_${seconds + 1}.jpg`;
      let item: IGeoPoint;
      if (previtem && nextitem) {
        const totaldiff = nextitem.SampleTime - previtem.SampleTime;
        const startdiff = seconds - previtem.SampleTime;

        const latitude =
          previtem.MAPLatitude +
          ((nextitem.MAPLatitude - previtem.MAPLatitude) * startdiff) /
            totaldiff;
        const longitude =
          previtem.MAPLongitude +
          ((nextitem.MAPLongitude - previtem.MAPLongitude) * startdiff) /
            totaldiff;

        const altitude =
          previtem.MAPAltitude +
          ((nextitem.MAPAltitude - previtem.MAPAltitude) * startdiff) /
            totaldiff;

        item = new IGeoPoint({
          GPSDateTime: datetime,
          MAPLatitude: latitude,
          MAPLongitude: longitude,
          MAPAltitude: altitude,
          Image: filename,
          camera_model: commonData['Main:Model'],
          camera_make: commonData['Main:Make'],
          width: commonData['Main:ImageWidth'],
          height: commonData['Main:ImageHeight'],
          equirectangular:
            commonData['Main:ProjectionType'] === 'equirectangular',
        });
      } else {
        nextitem = datalist[datalist.length - 1];
        item = new IGeoPoint({
          GPSDateTime: nextitem.GPSDateTime,
          MAPLatitude: nextitem.MAPLatitude,
          MAPLongitude: nextitem.MAPLongitude,
          MAPAltitude: nextitem.MAPAltitude,
          Image: filename,
          camera_model: commonData['Main:Model'],
          camera_make: commonData['Main:Make'],
          width: commonData['Main:ImageWidth'],
          height: commonData['Main:ImageHeight'],
          equirectangular:
            commonData['Main:ProjectionType'] === 'equirectangular',
        });
      }

      exiftool
        .write(
          path.join(outputPath, filename),
          {
            AllDates: datetime.format('YYYY-MM-DDTHH:mm:ss'),
            GPSTimeStamp: datetime.format('HH:mm:ss'),
            GPSDateStamp: datetime.format('YYYY-MM-DD'),
            GPSLatitude: item.MAPLatitude,
            GPSLongitude: item.MAPLongitude,
            GPSAltitude: item.MAPAltitude,
            ProjectionType: commonData['Main:ProjectionType'],
            Make: commonData['Main:Make'],
          },
          ['-overwrite_original']
        )
        .then(() => {
          result.push(item);
          return cb();
        })
        .catch((error: Error) =>
          console.error('Error in writing tags: ', error)
        );
    },
    (err) => {
      if (!err) {
        callback(result, starttime);
      }
    }
  );
}

export async function splitVideos(
  inputPath: string,
  duration: number,
  outputPath: string,
  callback: CallableFunction
) {
  // eslint-disable-next-line new-cap
  const process = new ffmpeg(inputPath);
  process.then(
    (video) => {
      video.fnExtractFrameToJPG(
        outputPath,
        {
          number: Math.ceil(duration) + 1,
          file_name: '',
        },
        async (err: any, files: string[]) => {
          console.log('Extracting Images:', files);
          if (!err) {
            callback(null, files);
          } else {
            callback(err, []);
          }
        }
      );
    },
    (err) => {
      console.log('Reading Video Error:', err);
    }
  );
}

export function splitVideoToImage(
  win: BrowserWindow | null,
  tags: any,
  videoPath: string,
  outputPath: string
) {
  const { dataList, commonData } = getGPSVideoData(tags);
  const duration = Math.floor(commonData['Main:Duration']);

  if (dataList) {
    Async.waterfall(
      [
        (cb: CallableFunction) => {
          splitVideos(
            videoPath,
            duration,
            outputPath,
            (err: any, filenames: string[]) => {
              if (err) {
                cb(err);
              } else {
                cb(null);
              }
            }
          );
        },

        (cb: CallableFunction) => {
          writeTags2Image(
            outputPath,
            commonData,
            dataList,
            (datalist: IGeoPoint[]) => cb(null, datalist)
          );
        },
      ],
      function (err, datalist: IGeoPoint[]) {
        if (!err) {
          calculatePoints(datalist, [], function (error: any, result: any) {
            if (!error) {
              sendPoints(win, result.points);
              sendToClient(win, 'finish');
            } else {
              errorHandler(win, error);
            }
          });
        } else {
          errorHandler(win, err);
        }
      }
    );
  }
}

export function loadVideo(videoPath: string, callback: CallableFunction) {
  const exif = new ExifTool({
    taskTimeoutMillis: 1073741824,
    maxProcAgeMillis: 1073741825,
  });
  exif
    .read(videoPath, ['-ee', '-G3', '-s', '-api', 'largefilesupport=1'])
    .then((tags: typeof Tags) => {
      exif.end();
      return callback(null, tags);
    })
    .catch((err: Error) => {
      console.log('Loading Video: ', err);
      exif.end();
      callback(err);
    });
}

export function processVideo(
  win: BrowserWindow | null,
  videoPath: string,
  outputPath: string
) {
  loadVideo(videoPath, (error: any, tags: typeof Tags) => {
    if (error) {
      errorHandler(win, error);
    } else {
      splitVideoToImage(win, tags, videoPath, outputPath);
    }
  });
}
