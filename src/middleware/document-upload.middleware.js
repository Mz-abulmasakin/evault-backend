
import multer from "multer";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PERSONNEL = 10;

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const fields = [];

for (let i = 0; i < MAX_PERSONNEL; i++) {
  fields.push(
    { name: `personnel_${i}_passport`, maxCount: 1 },
    { name: `personnel_${i}_signature`, maxCount: 1 }
  );
}

const documentUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PERSONNEL * 2,
    fields: 50,
    fieldSize: 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG and PDF documents are allowed.")
      );
    }

    callback(null, true);
  },
});

export const uploadCacPersonnelDocuments =
  documentUpload.fields(fields);
