const AWS = require("aws-sdk");

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
});

// Create S3 instance with SigV4 signing
const s3 = new AWS.S3({
  signatureVersion: "v4",
});

// Bucket configuration
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "dorm-space-images";

function sanitizeFilename(fileName) {
  // Avoid weird characters in S3 keys; keep it simple and predictable.
  return String(fileName || "upload")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function assertAwsConfigured() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file"
    );
  }
  if (!BUCKET_NAME || BUCKET_NAME === "dorm-space-images") {
    console.warn(
      "Warning: Using default bucket name. Make sure S3_BUCKET_NAME is set in .env"
    );
  }
}

// Generate signed URL for uploading
const generateUploadURL = async (fileName, fileType) => {
  assertAwsConfigured();

  const params = {
    Bucket: BUCKET_NAME,
    Key: `listings/${Date.now()}-${sanitizeFilename(fileName)}`,
    ContentType: fileType,
    Expires: 300, // 5 minutes
  };

  try {
    const uploadURL = await s3.getSignedUrlPromise("putObject", params);
    return {
      uploadURL,
      key: params.Key,
    };
  } catch (error) {
    console.error("Error generating upload URL:", error);
    // Provide more helpful error messages
    if (error.code === "CredentialsError") {
      throw new Error(
        "AWS credentials are invalid. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
      );
    }
    if (error.code === "NoSuchBucket") {
      throw new Error(
        `S3 bucket "${BUCKET_NAME}" does not exist. Please create it or update S3_BUCKET_NAME in .env`
      );
    }
    if (error.code === "AccessDenied") {
      throw new Error(
        "Access denied to S3 bucket. Please check IAM user permissions"
      );
    }
    throw error;
  }
};

// Generate signed URL for uploading a profile picture (separate prefix from listings)
const generateProfileUploadURL = async (userId, fileName, fileType) => {
  assertAwsConfigured();

  const safeName = sanitizeFilename(fileName);
  const params = {
    Bucket: BUCKET_NAME,
    Key: `profiles/${userId}/${Date.now()}-${safeName}`,
    ContentType: fileType,
    Expires: 300, // 5 minutes
  };

  try {
    const uploadURL = await s3.getSignedUrlPromise("putObject", params);
    return {
      uploadURL,
      key: params.Key,
    };
  } catch (error) {
    console.error("Error generating profile upload URL:", error);
    if (error.code === "CredentialsError") {
      throw new Error(
        "AWS credentials are invalid. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
      );
    }
    if (error.code === "NoSuchBucket") {
      throw new Error(
        `S3 bucket "${BUCKET_NAME}" does not exist. Please create it or update S3_BUCKET_NAME in .env`
      );
    }
    if (error.code === "AccessDenied") {
      throw new Error(
        "Access denied to S3 bucket. Please check IAM user permissions"
      );
    }
    throw error;
  }
};

// Generate signed URL for viewing (read-only)
const generateViewURL = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: 3600, // 1 hour
  };

  try {
    return await s3.getSignedUrlPromise("getObject", params);
  } catch (error) {
    console.error("Error generating view URL:", error);
    throw error;
  }
};

// Delete image from S3
const deleteImage = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

module.exports = {
  s3,
  BUCKET_NAME,
  generateUploadURL,
  generateProfileUploadURL,
  generateViewURL,
  deleteImage,
};
