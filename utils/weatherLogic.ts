export const isBadWeather = (weatherData: any, threshold: boolean): boolean => {
  if (!weatherData) return false;
  const isBad = threshold;
  const conditionType =
    weatherData?.weatherCondition?.type?.toUpperCase() || "";

  console.log(conditionType, isBad);
  const badWeatherTypes = new Set([
    "WIND_AND_RAIN",
    "LIGHT_RAIN_SHOWERS",
    "CHANCE_OF_SHOWERS",
    "SCATTERED_SHOWERS",
    "RAIN_SHOWERS",
    "HEAVY_RAIN_SHOWERS",
    "LIGHT_TO_MODERATE_RAIN",
    "MODERATE_TO_HEAVY_RAIN",
    "RAIN",
    "LIGHT_RAIN",
    "HEAVY_RAIN",
    "RAIN_PERIODICALLY_HEAVY",
    "HAIL",
    "HAIL_SHOWERS",
    "THUNDERSTORM",
    "THUNDERSHOWER",
    "LIGHT_THUNDERSTORM_RAIN",
    "SCATTERED_THUNDERSTORMS",
    "HEAVY_THUNDERSTORM",
  ]);
  return badWeatherTypes.has(conditionType) || threshold;
};
