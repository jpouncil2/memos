import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { attachmentServiceClient } from "@/connect";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { CreateAttachmentRequestSchema, AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { getAccessToken } from "@/auth-state";
import type { LocalFile } from "../types/attachment";

export const uploadService = {
  async uploadFileWithProgress(
    localFile: LocalFile,
    onProgress: (progress: number) => void
  ): Promise<Attachment> {
    const { file } = localFile;
    const url = `${window.location.origin}/memos.api.v1.AttachmentService/CreateAttachment`;
    const token = getAccessToken();

    const request = create(CreateAttachmentRequestSchema, {
      attachment: create(AttachmentSchema, {
        filename: file.name,
        size: BigInt(file.size),
        type: file.type,
        content: new Uint8Array(await file.arrayBuffer()),
      }),
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/proto");
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Connect responses for binary are prefixed by a 5-byte header
            // [0] (flags) [1-4] (length). For unary, it's just the message if no compression.
            // However, Connect-web handles this. In a raw XHR, we get the bytes.
            const responseData = new Uint8Array(xhr.response);
            // Connect unary binary format is [flags] [length] [message]
            // For now, let's try reading the message directly or skipping header if present.
            // Most Connect implementations send the header.
            let messageData = responseData;
            if (responseData[0] === 0 && responseData.length > 5) {
              const len = (responseData[1] << 24) | (responseData[2] << 16) | (responseData[3] << 8) | responseData[4];
              if (len + 5 <= responseData.length) {
                messageData = responseData.slice(5, 5 + len);
              }
            }

            const attachment = fromBinary(AttachmentSchema, messageData);
            resolve(attachment);
          } catch (e) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.responseType = "arraybuffer";
      xhr.send(toBinary(CreateAttachmentRequestSchema, request));
    });
  },

  async uploadFiles(localFiles: LocalFile[]): Promise<Attachment[]> {
    if (localFiles.length === 0) return [];

    const attachments: Attachment[] = [];

    for (const localFile of localFiles) {
      if (localFile.attachment) {
        attachments.push(localFile.attachment);
        continue;
      }

      const attachment = await attachmentServiceClient.createAttachment({
        attachment: create(AttachmentSchema, {
          filename: localFile.file.name,
          size: BigInt(localFile.file.size),
          type: localFile.file.type,
          content: new Uint8Array(await localFile.file.arrayBuffer()),
        }),
      });
      attachments.push(attachment);
    }

    return attachments;
  },
};
