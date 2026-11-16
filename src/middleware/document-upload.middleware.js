
import multer from "multer";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PERSONNEL = 10;
const MAX_ADMIN_DOCUMENTS = 10;

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const storage = multer.memoryStorage();

function fileFilter(req, file, callback) {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(
      new Error("Only JPEG, PNG and PDF documents are allowed.")
    );
  }

  callback(null, true);
}

// =========================================================
// CAC CUSTOMER PERSONNEL DOCUMENT UPLOAD
// =========================================================

const personnelFields = [];

for (let i = 0; i < MAX_PERSONNEL; i++) {
  personnelFields.push(
    {
      name: `personnel_${i}_passport`,
      maxCount: 1,
    },
    {
      name: `personnel_${i}_signature`,
      maxCount: 1,
    }
  );
}

const personnelUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PERSONNEL * 2,
    fields: 50,
    fieldSize: 1024 * 1024,
  },
  fileFilter,
});

export const uploadCacPersonnelDocuments =
  personnelUpload.fields(personnelFields);

// =========================================================
// ADMIN COMPLETED SERVICE DOCUMENT UPLOAD
// =========================================================

const adminDocumentUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_ADMIN_DOCUMENTS,
  },
  fileFilter,
});

export const uploadAdminServiceDocuments =
  adminDocumentUpload.array("documents", MAX_ADMIN_DOCUMENTS);
