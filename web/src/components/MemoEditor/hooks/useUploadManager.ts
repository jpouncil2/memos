import { useEffect } from "react";
import { uploadService } from "../services";
import { useEditorContext } from "../state";

export const useUploadManager = () => {
  const { state, actions, dispatch } = useEditorContext();

  useEffect(() => {
    state.localFiles.forEach((localFile) => {
      // If file has no progress and no attachment, it means it's newly added and needs upload
      if (typeof localFile.progress === "undefined" && !localFile.attachment && !localFile.error) {
        // Start upload
        dispatch(actions.updateLocalFile(localFile.previewUrl, { progress: 0 }));

        uploadService
          .uploadFileWithProgress(localFile, (progress) => {
            dispatch(actions.updateLocalFile(localFile.previewUrl, { progress }));
          })
          .then((attachment) => {
            dispatch(actions.updateLocalFile(localFile.previewUrl, { progress: 100, attachment }));
          })
          .catch((error) => {
            dispatch(actions.updateLocalFile(localFile.previewUrl, { error: error.message || "Upload failed" }));
          });
      }
    });
  }, [state.localFiles, actions, dispatch]);
};
