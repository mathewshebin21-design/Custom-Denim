/**
 * Detects an image's actual format from its file signature ("magic bytes"),
 * independent of whatever Content-Type the browser declared. A renamed or
 * mislabeled file (e.g. a script claiming to be image/png) will not match
 * any of these signatures and is rejected regardless of its declared type
 * or extension — this is the check that matters, not the declared MIME type.
 *
 * Deliberately supports only the three formats the app accepts elsewhere
 * (PNG/JPEG/WEBP). Anything else — including SVG, which can carry inline
 * scripts — returns null and is rejected upstream.
 */
export function detectImageExtension(bytes: Buffer): "png" | "jpg" | "webp" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "webp";
  }

  return null;
}

/**
 * Same magic-bytes approach as detectImageExtension, for the one video
 * format the rest of the app already standardizes on (see the ffmpeg
 * re-encode convention used for every other video asset in public/video/).
 * An MP4/MOV (ISO base media) file has an "ftyp" box starting at byte 4,
 * regardless of the specific brand — checking that box, not a declared
 * Content-Type or filename extension, is what actually confirms the bytes
 * are a real ISO-BMFF container.
 */
export function detectVideoExtension(bytes: Buffer): "mp4" | null {
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 // p
  ) {
    return "mp4";
  }
  return null;
}
