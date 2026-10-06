export function publicApplicationUrl(
  pathname: string,
  requestUrl: string,
  configuredBaseUrl = process.env.APP_BASE_URL,
) {
  const baseUrl = new URL(configuredBaseUrl?.trim() || requestUrl);
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("APP_BASE_URL must use http or https");
  }
  return new URL(pathname, baseUrl.origin);
}
