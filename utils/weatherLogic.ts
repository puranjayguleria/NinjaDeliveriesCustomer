export type WeatherThreshold = {
  precipMmPerHr?: number;
  windSpeedKph?: number;
};

export const isBadWeather = (
  weatherData: any,
  threshold: WeatherThreshold
): boolean => {
  if (!weatherData) return false;

  const precipMm = weatherData?.precipitation?.qpf?.quantity ?? 0;
  const windKph = weatherData?.wind?.speed?.value ?? 0;

  const precipThreshold = threshold.precipMmPerHr ?? 0.3;
  const windThreshold = threshold.windSpeedKph ?? 25;

  const isRainy = precipMm > precipThreshold;
  const isWindy = windKph > windThreshold;

  return isRainy || isWindy;
};
