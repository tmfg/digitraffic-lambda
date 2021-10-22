/**
 * Returns a new copy of an array, shuffled using Math.random()
 * @param array Array
 */
export function shuffle(array: any[]): any[] {
    // pretty fast way to copy an array, not necessarily the fastest
    const newArray = array.slice(0)
    newArray.sort((x) => 0.5 - Math.random())
    return newArray
}

/**
 * Decode given string from base64 to ascii
 * @param str string
 */
export function decodeBase64ToAscii(str: string) {
    return decodeBase64(str, 'ascii');
}

export function decodeBase64(str: string, encoding: BufferEncoding) {
    return Buffer.from(str, 'base64').toString(encoding);
}
