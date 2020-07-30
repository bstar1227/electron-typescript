import { BrowserWindow } from 'electron';
import { IGeoPoint } from '../../types/IGeoPoint';
import { Result, Summary } from '../../types/Result';

export function sendToClient(
  win: BrowserWindow | null,
  channelname: string,
  ...args: any[]
) {
  // eslint-disable-next-line global-require
  if (win) win.webContents.send(channelname, ...args);
}

export function sendPoints(win: BrowserWindow | null, points: IGeoPoint[]) {
  sendToClient(
    win,
    'set-points',
    points.map((item: IGeoPoint) => {
      item.convertDateToStr();
      return item;
    })
  );
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export function getDistance(point1: any, point2: any) {
  if (!point1 || !point2) {
    return 0;
  }
  const lat2 = point2.GPSLatitude;
  const lon2 = point2.GPSLongitude;
  const lat1 = point1.GPSLatitude;
  const lon1 = point1.GPSLongitude;
  const R = 6371 * 1000; // Radius of the earth in meter
  const dLat = deg2rad(lat2 - lat1); // deg2rad below
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

export function createdData2List(data: Result): Summary {
  const { sequence, photo } = data;
  return {
    id: sequence.id,
    tags: sequence.uploader_tags,
    name: sequence.uploader_sequence_name,
    description: sequence.uploader_sequence_description,
    type: sequence.uploader_transport_type,
    method: sequence.uploader_transport_method,
    points: Object.values(photo),
    total_km: sequence.distance_km,
    created: sequence.created,
    captured: sequence.earliest_time,
  };
}

export function getBearing(point1: IGeoPoint, point2: IGeoPoint) {
  const lng1 = point1.GPSLongitude;
  const lat1 = point1.GPSLatitude;
  const lng2 = point2.GPSLongitude;
  const lat2 = point2.GPSLatitude;

  console.log('POINT1: ', lng1, lat1);
  console.log('POINT2: ', lng2, lat2);

  const dLon = lng2 - lng1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  console.log('Azimuth: ', brng);
  return brng;
}

export function getPitch(
  point1: IGeoPoint,
  point2: IGeoPoint,
  distance: number
) {
  return distance !== 0
    ? (point2.GPSAltitude - point1.GPSAltitude) / distance
    : 0;
}