import { Attachment, EmbedBuilder, Message } from "discord.js";
import { AttachmentUploadData } from "../@types/data/attachmentUploadData.js";
import { PhotoUploadData } from "../@types/data/photoUploadData.js";
import { SupportedContentType } from "../@types/data/supportedContentType.js";
import { SupportedPhotoType } from "../@types/data/supportedPhotoType.js";
import { getContentTypeFromMimeType } from "../api/photostation/utils/getContentTypeFromMimeType.js";
import { formatBytes } from "../utils/formatBytes.js";
import { getBlobFromUrl } from "../utils/getBlobFromUrl.js";
import { VideoUploadData } from "./../@types/data/videoUploadData";

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(message: Message) {
    if (message.author.bot || message.attachments.size === 0) {
      return;
    }

    // Get all the attachments, their size, and the requester's name
    const attachments = message.attachments.map((attachment) => attachment);
    const requesterName = message.author.username;
    const totalSizeString = getAttachmentsTotalSizeData(attachments);
    let uploadProgress = 0;

    // Send the initial "processing" message
    const processingMsgEmbed = getUploadStatusEmbed(
      UploadStatus.Processing,
      requesterName,
      totalSizeString,
      uploadProgress,
    );
    const initialMsgRef = await message.reply({ embeds: [processingMsgEmbed] });

    let blobs, contentTypes, ids, unsupportedAttachmentsString;
    // The embed that the original embed will be changed to if an error occurs
    const uploadFailureMsgEmbed = getUploadStatusEmbed(
      UploadStatus.Failure,
      requesterName,
      totalSizeString,
      0,
    );
    try {
      ({ unsupportedAttachmentsString, blobs, contentTypes, ids } =
        await processAndValidateAttachments(attachments));
    } catch (err) {
      console.error("Error occurred while processing attachments:", err);
      // Edit the original embed, and reply to the user with an error message
      initialMsgRef.edit({ embeds: [uploadFailureMsgEmbed] });
      const errorEmbed = getErrorMsgEmbed(`An error occurred while processing attachments: ${err}`);
      message.reply({ embeds: [errorEmbed] });
      return;
    }

    // If there are unsupported attachments, handle them
    if (unsupportedAttachmentsString) {
      // If all attachments are unsupported, return immediately
      if (blobs.length === 0) {
        initialMsgRef.edit({ embeds: [uploadFailureMsgEmbed] });
        const errorEmbed = getErrorMsgEmbed(
          `All of the provided files are of unsupported formats: ${unsupportedAttachmentsString}. Please try again.`,
        );
        message.reply({ embeds: [errorEmbed] });
        return;
      } else {
        // If only some of the attachments are unsupported, just add a warning
        const warning = `Files of unsupported formats found: ${unsupportedAttachmentsString}. These will be ignored.`;
        message.reply(warning);
      }
    }

    // Update the loading progress to 40%, add warning if necessary
    uploadProgress = 0.4;
    const updatedProcessingMsg = getUploadStatusEmbed(
      UploadStatus.Processing,
      requesterName,
      totalSizeString,
      uploadProgress,
    );
    initialMsgRef.edit({ embeds: [updatedProcessingMsg] });

    // Convert all of the files into AttachmentUploadData objects
    const allFilesData: AttachmentUploadData[] = getAttachmentsUploadData(blobs, ids, contentTypes);

    // Update the loading status to 60%, and change the status to uploading
    uploadProgress = 0.6;
    const uploadingMsg = getUploadStatusEmbed(
      UploadStatus.Uploading,
      requesterName,
      totalSizeString,
      uploadProgress,
    );
    initialMsgRef.edit({ embeds: [uploadingMsg] });

    try {
      // await uploadFilesToPS(allFilesData);
    } catch (err) {
      console.error("Error occurred while uploading attachments:", err);
      initialMsgRef.edit(`An error occurred while uploading attachments: ${err}`);
      return;
    }
    uploadProgress = 1;
    const successMsg = getUploadStatusEmbed(
      UploadStatus.Success,
      requesterName,
      totalSizeString,
      uploadProgress,
    );
    initialMsgRef.edit({ embeds: [successMsg] });
  },
};

/**
 * Represents the status of the upload.
 */
enum UploadStatus {
  Processing = "Processing attachments...",
  Uploading = "Uploading attachments...",
  Success = "Upload complete",
  Failure = "Upload failed",
}

/**
 * Returns an EmbedBuilder object that represents an error message.
 * @param errMsg the error message to be displayed
 * @returns an EmbedBuilder with the error message
 */
const getErrorMsgEmbed = (errMsg: string): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setTitle("Upload failed")
    .setDescription(errMsg)
    .setColor(getEmbedColor(UploadStatus.Failure));
  return embed;
};

/**
 * Returns an EmbedBuilder object that contains information on the upload's
 * current status and other data.
 * @param status the status of the upload
 * @param requesterName the username of the user who requested the upload
 * @param uploadSize a string representation of the upload size (e.g. 21MB)
 * @param uploadProgress the progress of the upload represented as a decimal
 *                       between 0 and 1
 * @returns an EmbedBuilder containing all of the given information
 */
const getUploadStatusEmbed = (
  status: UploadStatus,
  requesterName: string,
  uploadSize: string,
  uploadProgress: number,
): EmbedBuilder => {
  if (uploadProgress > 1 || uploadProgress < 0 || status == null) {
    throw Error("Invalid argument(s): status cannot be null and 0 < uploadProgress < 1");
  }

  const loadingBarLength = 20;
  const loadingBarFilledChar = "🟦";
  const loadingBarEmptyChar = "⬜";
  const filledSection = loadingBarFilledChar.repeat(Math.round(loadingBarLength * uploadProgress));
  const loadingBar = filledSection.padEnd(
    // The filled character is length 2 for some reason, so we need to add extra
    // empty characters
    loadingBarLength + filledSection.length / 2,
    loadingBarEmptyChar,
  );
  const loadedPercentage = `${Math.round(uploadProgress * 100)}%`;
  const embedColor = getEmbedColor(status);
  const fields = [
    {
      name: "Status",
      value: status,
      inline: true,
    },
    {
      name: "Upload size",
      value: uploadSize,
      inline: true,
    },
    {
      name: "Requested by",
      value: requesterName,
      inline: true,
    },
  ];

  // The spaces around the description are intentional. Do not remove them,
  // otherwise the carriage returns won't work
  const embed = new EmbedBuilder()
    .setTitle("Upload Request")
    .setDescription(`‎\n${loadingBar}\n(${loadedPercentage})\n‎`)
    .setColor(embedColor)
    .setFields(fields);

  return embed;
};

/**
 * Returns the appropriate color given the current upload status.
 * @param status the current upload status
 * @returns a hexadecimal number representing the associated color
 */
const getEmbedColor = (status: UploadStatus): number => {
  // Red
  if (status == UploadStatus.Failure) {
    return 0xfc100d;
  }

  // Blue
  return 0x58acec;
};

/**
 * Produces a formatted string representation of the total size of the given files.
 * @param attachments the attachments in question
 * @returns a formatted string representation of the files' total size (e.g. 12MB)
 */
const getAttachmentsTotalSizeData = (attachments: Attachment[]): string => {
  const totalSizeBytes = attachments.reduce((size, file) => size + file.size, 0);
  const totalSizeString = formatBytes(totalSizeBytes);
  return totalSizeString;
};

/**
 * Converts attachment data into a array of AttachmentUploadData objects. This
 * assumes that blobs[i], ids[i], and contentTypes[i] all correspond to the same file.
 * @param blobs the blobs corresponding to each attachment
 * @param ids the ids for each attachment
 * @param contentTypes the content types for each attachment
 * @returns a array of the corresponding AttachmentUploadData objects
 */
const getAttachmentsUploadData = (
  blobs: Blob[],
  ids: string[],
  contentTypes: SupportedContentType[],
): AttachmentUploadData[] => {
  return blobs.map((blob, i) => {
    const id = ids[i];
    const contentType = contentTypes[i];

    let data;
    if (contentType instanceof SupportedPhotoType) {
      data = new PhotoUploadData(blob, id, [], contentTypes[i]);
    } else {
      data = new VideoUploadData(blob, id, [], contentTypes[i]);
    }
    return data;
  });
};

/**
 * Processes an array of attachments, filtering out invalid attachments (of
 * unsupported types) and extracting data from valid ones
 * @param attachments - The array of attachments to process.
 * @returns An object containing:
 *      - unsupportedAttachmentsString: A string listing unsupported
 *        attachments, each separated by commas (e.g. video1.m4v, image2.HEIC...).
 *      - blobs: An array of Blob objects for valid attachments.
 *      - ids: An array of IDs for valid attachments.
 *      - contentTypes: An array of content types for valid attachments.
 *      (Note: blobs[i], ids[i], and contentTypes[i] correspond to the same file.)
 * @throws an error if a file extension is not recognized, or if there isn't a
 *     SupportedContentType associated with the MIME type found (see getContentTypeFromString).
 */
const processAndValidateAttachments = async (attachments: Attachment[]) => {
  const blobs: Blob[] = [];
  const ids: string[] = [];
  const unsupportedAttachments: string[] = [];
  const contentTypes: SupportedContentType[] = [];

  for (const attachment of attachments) {
    const attachmentName = attachment.name;
    const mimeType = attachment.contentType;
    if (!mimeType) {
      unsupportedAttachments.push(`${attachmentName} (unknown type)`);
      continue;
    }

    const contentType = getContentTypeFromMimeType(mimeType);
    // Content type is not recognized
    if (!contentType) {
      unsupportedAttachments.push(`${attachmentName} (${mimeType})`);
      continue;
    }
    contentTypes.push(contentType);
    ids.push(attachment.id);
    const file = await getBlobFromUrl(attachment.url);
    blobs.push(file);
  }

  const unsupportedAttachmentsString = unsupportedAttachments.join(", ");
  return { unsupportedAttachmentsString, blobs, ids, contentTypes };
};
