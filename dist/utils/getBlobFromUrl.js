/**
 * Takes the url to an attachment, gets the attachment and converts it into a
 * Blob object.
 * @param url the url to the attachment
 * @returns a Blob object corresponding to the attachment
 */
const getBlobFromUrl = async (url) => {
    const res = await fetch(url);
    return await res.blob();
};
export default getBlobFromUrl;
//# sourceMappingURL=getBlobFromUrl.js.map