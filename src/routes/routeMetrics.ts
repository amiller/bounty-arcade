export interface RouteTrackPoint {
  timestampSec: number;
  distanceMetersDelta: number;
}

export interface RouteTimeSpeedMetrics {
  elapsedTimeSec: number;
  movingTimeSec: number;
  averageSpeedMps: number;
  movingSpeedMps: number;
}

export function computeRouteTimeAndSpeed(
  points: readonly RouteTrackPoint[],
  minMovingSpeedMps: number = 0.5
): RouteTimeSpeedMetrics {
  if (points.length < 2) {
    return { elapsedTimeSec: 0, movingTimeSec: 0, averageSpeedMps: 0, movingSpeedMps: 0 };
  }
  const elapsedTimeSec = Math.max(0, points[points.length - 1].timestampSec - points[0].timestampSec);
  let movingTimeSec = 0;
  let totalDistanceMeters = 0;

  for (let i = 1; i < points.length; i++) {
    const dt = Math.max(0, points[i].timestampSec - points[i - 1].timestampSec);
    const dist = Math.max(0, points[i].distanceMetersDelta);
    totalDistanceMeters += dist;
    if (dt > 0 && dist / dt >= minMovingSpeedMps) {
      movingTimeSec += dt;
    }
  }

  return {
    elapsedTimeSec,
    movingTimeSec,
    averageSpeedMps: elapsedTimeSec > 0 ? Number((totalDistanceMeters / elapsedTimeSec).toFixed(4)) : 0,
    movingSpeedMps: movingTimeSec > 0 ? Number((totalDistanceMeters / movingTimeSec).toFixed(4)) : 0,
  };
}
