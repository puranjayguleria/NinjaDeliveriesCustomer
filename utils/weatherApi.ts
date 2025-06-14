export const getGoogleWeatherData = async (
  lat: number,
  lng: number,
  apiKey: string
) => {
  try {
    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${lat}&location.longitude=${lng}`;
    const response = await fetch(url);
    const data = await response.json();

    // Validate that essential fields are present
    if (!data || !data.precipitation || !data.wind) {
      throw new Error("No valid weather data found.");
    }

    return data;
  } catch (error) {
    console.error("[getGoogleWeatherData]", error);
    return null;
  }
};
