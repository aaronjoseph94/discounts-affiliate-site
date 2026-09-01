/** One Blobs store for deals, settings, and the uploaded logo. */
export const BLOB_STORE = "deals-db";

export async function siteStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: BLOB_STORE, consistency: "strong" });
}
