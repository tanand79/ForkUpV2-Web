/**
 * Label for a stored booking URL on the public campaign card.
 * Inputs: reservation URL from the location. Outputs: "Book on Resy" style label.
 */
export function bookingCtaLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "resy.com" || host.endsWith(".resy.com")) return "Book on Resy";
    if (host === "opentable.com" || host.endsWith(".opentable.com")) return "Book on OpenTable";
    if (host === "exploretock.com" || host.endsWith(".exploretock.com")) return "Book on Tock";
    if (host === "tock.com" || host.endsWith(".tock.com")) return "Book on Tock";
    if (host === "sevenrooms.com" || host.endsWith(".sevenrooms.com")) return "Book on SevenRooms";
    if (host === "thefork.com" || host.endsWith(".thefork.com")) return "Book on TheFork";
    if (host === "yelp.com" || host.endsWith(".yelp.com")) return "Book on Yelp";
    return "Continue to Reservation";
  } catch {
    return "Continue to Reservation";
  }
}
