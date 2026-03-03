export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send("Missing ?url=");
    }

    let target;
    try {
      target = new URL(url);
    } catch {
      return res.status(400).send("Invalid URL");
    }

    const response = await fetch(target.toString());

    // Copy status
    res.status(response.status);

    // Copy headers safely
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-encoding") {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy failed: " + err.message);
  }
}
